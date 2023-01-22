namespace Gttsb.Core
{
    public interface IGitHubFacadeFactory
    {
        Task<IInstalledGitHubFacade> CreateClientForOrgAsync(Installation installation);
        Task<Installation> GetInstallationAsync(long installationId);
        Task<IEnumerable<Core.Installation>> GetInstallationsAsync();
    }
}
