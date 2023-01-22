using Gttsb.Core;
using Octokit;

namespace Gttsb.Gh
{
    public sealed class GitHubFacadeFactory : IGitHubFacadeFactory
    {
        private readonly GitHubClient gitHubClient;

        public GitHubFacadeFactory(GitHubClient gitHubClient)
        {
            this.gitHubClient = gitHubClient;
        }

        public async Task<IInstalledGitHubFacade> CreateClientForOrgAsync(Core.Installation installation)
        {
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
            // TODO: implement paging!!
            var installations = await gitHubClient.GitHubApps.GetAllInstallationsForCurrent();

            return installations.Select(i => new Core.Installation(i.Id, i.Account.Name)).ToList();
        }
    }
}
