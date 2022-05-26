namespace Gttsb.Core
{
    public interface IGitHubFacade
    {
        Task<IEnumerable<GitHubTeam>> GetAllTeamsAsync(string org);
        Task<MemberCheckResult> IsUserMemberAsync(string gitHubOrg, string gitHubId);
        Task<OperationResponse> AddOrgMemberAsync(string gitHubOrg, string gitHubId);
        Task AddTeamMemberAsync(int teamId, string userGitHubId);        
        Task<GitHubTeam> CreateTeamAsync(string gitHubOrg, string name);
    }
}
