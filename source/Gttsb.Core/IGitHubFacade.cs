namespace Gttsb.Core
{
    public interface IGitHubFacadeFactory
    {
        Task<IInstalledGitHubFacade> CreateClientForOrgAsync(Installation installation);
        Task<IEnumerable<Core.Installation>> GetInstallationsAsync();
    }
}
