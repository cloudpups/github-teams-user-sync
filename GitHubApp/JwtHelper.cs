using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;

namespace GitHubApp
{
    internal static class JwtHelper
    {
		public static string GetJwt(string privateKey, string appId)
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
