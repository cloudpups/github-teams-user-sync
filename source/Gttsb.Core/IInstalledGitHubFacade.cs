﻿namespace Gttsb.Core
{
    public interface IInstalledGitHubFacade
    {
        Task<IReadOnlyDictionary<string, GitHubTeam>> GetAllTeamsAsync(string org);
        Task<ValidGitHubId?> DoesUserExistAsync(string gitHubId);
        Task<MemberCheckResult> IsUserMemberAsync(string gitHubOrg, ValidGitHubId gitHubId);
        Task<OperationResponse> AddOrgMemberAsync(string gitHubOrg, ValidGitHubId gitHubId);
        Task AddTeamMemberAsync(GitHubTeam team, ValidGitHubId userGitHubId);        
        Task<GitHubTeam> CreateTeamAsync(string gitHubOrg, string name);        
        Task<ICollection<ValidGitHubId>> ListCurrentMembersOfGitHubTeamAsync(GitHubTeam team);
        Task RemoveTeamMemberAsync(GitHubTeam team, ValidGitHubId validUser);
        Task UpdateTeamDetailsAsync(string org, GitHubTeam specificTeam, string description);
        Task<GhDeployment> CreateDeploymentAsync(string gitHubOrg);
        Task UpdateDeploymentAsync(GhDeployment deployment, GhDeployment.Status status);
    }
}