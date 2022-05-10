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

        public async Task AddOrgMemberAsync(string gitHubOrg, string gitHubId)
        {
            var orgMembershipUpdate = new OrganizationMembershipUpdate();
            // TODO: do something with response
            await gitHubClient.Organization.Member.AddOrUpdateOrganizationMembership(gitHubOrg, gitHubId, orgMembershipUpdate);
        }

        public async Task<MemberCheckResult> IsUserMemberAsync(string gitHubOrg, string gitHubId)
        {
            try
            {
                return await gitHubClient.Organization.Member.CheckMember(gitHubOrg, gitHubId) ? MemberCheckResult.IsMember : MemberCheckResult.IsNotOrgMember;
            }     
            catch(NotFoundException)
            {
                return MemberCheckResult.UserIdDoesNotExist;
            }
        }

        public async Task<IEnumerable<GitHubTeam>> GetAllTeamsAsync(string org)
        {
            // TODO: page!!
            var teams = await gitHubClient.Organization.Team.GetAll(org);

            return teams.Select(t => new GitHubTeam(t.Id, t.Name));
        }

        public async Task AddTeamMemberAsync(int teamId, string userGitHubId)
        {
            var updateMemberRequest = new UpdateTeamMembership(TeamRole.Member);
            await gitHubClient.Organization.Team.AddOrEditMembership(teamId, userGitHubId, updateMemberRequest);
        }
    }
}
