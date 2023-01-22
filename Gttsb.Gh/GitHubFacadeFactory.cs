using Gttsb.Core;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Octokit;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;

namespace Gttsb.Gh
{
    public sealed class GitHubFacadeFactory : IGitHubFacadeFactory
    {
        private readonly IOptions<AppOptions> options;

        public GitHubFacadeFactory(IOptions<AppOptions> options)
        {
            this.options = options;
        }

        private IGitHubClient GetInitialClient(AppOptions options)
        {
            // TODO: make this threadsafe and singleton so that a new client isn't created per request...
            // Logic must also be added so that if in the middle of processing, a new client could be generated in
            // case a call fails due to expiration of token. Though, short requests should be preferred anyways.
            var jwt = GetJwt(options.PrivateKey, options.AppId);

            return new GitHubClient(new ProductHeaderValue(Statics.AppName))
            {
                Credentials = new Credentials(jwt, AuthenticationType.Bearer)
            };
        }

        public async Task<IInstalledGitHubFacade> CreateClientForOrgAsync(Core.Installation installation)
        {
            var gitHubClient = GetInitialClient(options.Value);
            var response = await gitHubClient.GitHubApps.CreateInstallationToken(installation.Id);

            // Create a new GitHubClient using the installation token as authentication
            var installationClient = new GitHubClient(new ProductHeaderValue($"{installation.OrgName}-{installation.Id}"))
            {
                Credentials = new Credentials(response.Token)
            };

            return new InstalledGitHubFacade(installationClient);
        }

        public async Task<IEnumerable<Core.Installation>> GetInstallationsAsync()
        {
            var gitHubClient = GetInitialClient(options.Value);

            // TODO: implement paging!!
            var installations = await gitHubClient.GitHubApps.GetAllInstallationsForCurrent();

            return installations.Select(i => new Core.Installation(i.Id, i.Account.Login)).ToList();
        }

        private static string GetJwt(string privateKey, string appId)
        {
            // https://docs.hidglobal.com/auth-service/docs/buildingapps/csharp/create-and-sign-a-json-web-token--jwt--with-c--and--net.htm			

            privateKey = privateKey.Replace("-----BEGIN PRIVATE KEY-----", "");
            privateKey = privateKey.Replace("-----END PRIVATE KEY-----", "");

            RSACryptoServiceProvider provider = new RSACryptoServiceProvider();
            provider.ImportFromPem(privateKey);
            RsaSecurityKey rsaSecurityKey = new RsaSecurityKey(provider);

            var handler = new JwtSecurityTokenHandler();

            var signingCredentials = new SigningCredentials(rsaSecurityKey, SecurityAlgorithms.RsaSha256);

            var header = new JwtHeader(signingCredentials);
            var notBefore = DateTime.UtcNow;
            var expires = notBefore.AddMinutes(10);
            var issuedAt = DateTime.UtcNow;
            var payload = new JwtPayload(issuer: appId, "", Enumerable.Empty<Claim>(), notBefore, expires, issuedAt);

            var token = new JwtSecurityToken
            (
                header: header,
                payload: payload
            );

            return handler.WriteToken(token);
        }
    }
}
