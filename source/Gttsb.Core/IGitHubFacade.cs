namespace Gttsb.Core
{
    public interface IGitHubFacade
    {
        Task<IEnumerable<GitHubTeam>> GetAllTeamsAsync(string org);
        Task<GitHubUserCheckResult> GitHubUserCheckAsync(string gitHubOrg, string gitHubId);
        Task<OperationResponse> AddOrgMemberAsync(string gitHubOrg, ValidGitHubId gitHubId);
        Task AddTeamMemberAsync(int teamId, ValidGitHubId userGitHubId);        
        Task<GitHubTeam> CreateTeamAsync(string gitHubOrg, string name);
    }
}
