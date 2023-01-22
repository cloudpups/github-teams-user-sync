using Microsoft.Extensions.Caching.Memory;

namespace Gttsb.Core
{
    public sealed class GitHubFacadeCacheDecorator : IInstalledGitHubFacade
    {
        private readonly IInstalledGitHubFacade gitHubFacade;
        private readonly IMemoryCache memoryCache;

        public GitHubFacadeCacheDecorator(IInstalledGitHubFacade gitHubFacade, IMemoryCache memoryCache)
        {
            this.gitHubFacade = gitHubFacade;
            this.memoryCache = memoryCache;
        }

        public Task<OperationResponse> AddOrgMemberAsync(string gitHubOrg, ValidGitHubId gitHubId) => gitHubFacade.AddOrgMemberAsync(gitHubOrg, gitHubId);

        public Task AddTeamMemberAsync(GitHubTeam team, ValidGitHubId userGitHubId) => gitHubFacade.AddTeamMemberAsync(team, userGitHubId);

        public Task<GhDeployment> CreateDeploymentAsync(string gitHubOrg) => gitHubFacade.CreateDeploymentAsync(gitHubOrg);

        public Task<GitHubTeam> CreateTeamAsync(string gitHubOrg, string name) => gitHubFacade.CreateTeamAsync(gitHubOrg, name);

        public async Task<ValidGitHubId?> DoesUserExistAsync(string gitHubId)
        {
            // TODO: look up best practices when using a Delegate and Async
            return await memoryCache.GetOrCreateAsync($"DoesUserExistAsync-{gitHubId}", async cacheEntry =>
            {
                cacheEntry.SlidingExpiration = TimeSpan.FromMinutes(10);

                return await gitHubFacade.DoesUserExistAsync(gitHubId);
            });
        }

        public Task<IReadOnlyDictionary<string, GitHubTeam>> GetAllTeamsAsync(string org) => gitHubFacade.GetAllTeamsAsync(org);        

        public async Task<MemberCheckResult> IsUserMemberAsync(string gitHubOrg, ValidGitHubId gitHubId)
        {
            // TODO: look up best practices when using a Delegate and Async
            return await memoryCache.GetOrCreateAsync($"IsUserMemberAsync-${gitHubOrg}-${gitHubId.Id}", async cacheEntry =>
            {
                cacheEntry.SlidingExpiration = TimeSpan.FromMinutes(10);

                return await gitHubFacade.IsUserMemberAsync(gitHubOrg, gitHubId);
            });
        }

        public Task<ICollection<ValidGitHubId>> ListCurrentMembersOfGitHubTeamAsync(GitHubTeam team) => gitHubFacade.ListCurrentMembersOfGitHubTeamAsync(team);

        public Task RemoveTeamMemberAsync(GitHubTeam team, ValidGitHubId validUser) => gitHubFacade.RemoveTeamMemberAsync(team, validUser);

        public Task UpdateDeploymentAsync(GhDeployment deployment, GhDeployment.Status status) => gitHubFacade.UpdateDeploymentAsync(deployment, status);

        public Task UpdateTeamDetailsAsync(string org, GitHubTeam specificTeam, string description) => gitHubFacade.UpdateTeamDetailsAsync(org, specificTeam, description);
    }
}