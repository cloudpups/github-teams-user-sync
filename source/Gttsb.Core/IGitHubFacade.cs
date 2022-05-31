namespace Gttsb.Core
{
    public interface IGitHubFacade
    {
        Task<IEnumerable<GitHubTeam>> GetAllTeamsAsync(string org);
        Task<ValidGitHubId?> DoesUserExistAsync(string gitHubId);
        Task<MemberCheckResult> IsUserMemberAsync(string gitHubOrg, ValidGitHubId gitHubId);
        Task<OperationResponse> AddOrgMemberAsync(string gitHubOrg, ValidGitHubId gitHubId);
        Task AddTeamMemberAsync(int teamId, ValidGitHubId userGitHubId);        
        Task<GitHubTeam> CreateTeamAsync(string gitHubOrg, string name);
    }
}
