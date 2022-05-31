using Gttsb.Core;
using Octokit;

namespace GitHubAction
{
    internal sealed class GitHubFacade : IGitHubFacade
    {
        private readonly GitHubClient gitHubClient;

        public GitHubFacade(GitHubClient gitHubClient)
        {
            this.gitHubClient = gitHubClient;
        }

        public async Task<OperationResponse> AddOrgMemberAsync(string gitHubOrg, ValidGitHubId gitHubId)
        {
            var orgMembershipUpdate = new OrganizationMembershipUpdate();
            try
            {
                // TODO: do something with response
                await gitHubClient.Organization.Member.AddOrUpdateOrganizationMembership(gitHubOrg, gitHubId.Id, orgMembershipUpdate);
            }            
            catch(Exception ex)
            {
                return OperationResponse.Failed($"Failed to add org member: ${ex.Message}");
            }

            return OperationResponse.Succeeded();
        }

        public async Task<GitHubUserCheckResult> GitHubUserCheckAsync(string gitHubOrg, string gitHubId)
        {
            // TODO: fix this try catch, additional error handling was added elsewhere that should have also been caught by this 
            // (though it is better to be safe than sorry I suppose).
            try
            {                
                var result = await gitHubClient.Organization.Member.CheckMember(gitHubOrg, gitHubId) ? MemberCheckResult.IsMember : MemberCheckResult.IsNotOrgMember;

                return new GitHubUserCheckResult(result, new ValidGitHubId(gitHubId));
            }     
            catch(NotFoundException)
            {
                return new GitHubUserCheckResult(MemberCheckResult.UserIdDoesNotExist, null);  
            }
        }

        public async Task<IEnumerable<GitHubTeam>> GetAllTeamsAsync(string org)
        {
            // TODO: page!!
            var teams = await gitHubClient.Organization.Team.GetAll(org, new ApiOptions
            {
                // 100 is max page size via the API
                PageSize = 100
            });

            return teams.Select(t => new GitHubTeam(t.Id, t.Name));
        }

        public async Task AddTeamMemberAsync(int teamId, ValidGitHubId userGitHubId)
        {
            var updateMemberRequest = new UpdateTeamMembership(TeamRole.Member);
            await gitHubClient.Organization.Team.AddOrEditMembership(teamId, userGitHubId.Id, updateMemberRequest);
        }

        public async Task<GitHubTeam> CreateTeamAsync(string gitHubOrg, string name)
        {
            var newTeam = await gitHubClient.Organization.Team.Create(gitHubOrg, new NewTeam(name));

            return new GitHubTeam(newTeam.Id, newTeam.Name);
        }
    }
}
