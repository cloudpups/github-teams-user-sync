namespace Gttsb.Core
{
    internal sealed class GroupSyncer : IGroupSyncer
    {
        private readonly IActiveDirectoryFacade _activeDirectoryFacade;
        private readonly IGitHubFacade _gitHubFacade;
        private readonly IEmailToCloudIdConverter _emailToGitHubIdConverter;

        public GroupSyncer(IActiveDirectoryFacade activeDirectoryFacade, IGitHubFacade gitHubFacade, IEmailToCloudIdConverter emailToCloudIdConverter)
        {
            _activeDirectoryFacade = activeDirectoryFacade;
            _gitHubFacade = gitHubFacade;
            _emailToGitHubIdConverter = emailToCloudIdConverter;
        }

        public async Task<GroupSyncResult> SyncronizeGroupsAsync(string gitHubOrg, IEnumerable<TeamDefinition> teams)
        {
            var teamSyncFailures = new List<string>();
            var usersThatMayNotExist = new List<GitHubUser>();

            // TODO: would be better to have a _gitHubTeamService expose a method of GetTeamDetailsAsync
            // where if would retrieve or create a team and return the details of that instead of exposing
            // GetAllTeams and having this GroupSyncer have the responsibility of filtering the teams
            // and using them here.
            var allTeams = await _gitHubFacade.GetAllTeamsAsync(gitHubOrg);

            foreach (var team in teams)
            {                
                var specificTeam = allTeams.FirstOrDefault(t => t.Name == team.Name);

                if(specificTeam == null)
                {
                    specificTeam = _gitHubFacade.CreateTeamAsync(gitHubOrg, team.Name);
                }

                var membersResponse = await _activeDirectoryFacade.FetchMembersAsync(team.Name);

                if (!membersResponse.Success)
                {
                    teamSyncFailures.Add(team.Name);
                    // try syncing other teams
                    continue;
                }

                var groupMembersWithGitHubIds = membersResponse.Members.Select(m => new
                {
                    m.Id,
                    m.DisplayName,
                    m.Email,
                    GitHubId = _emailToGitHubIdConverter.ToId(m.Email)
                });                                          

                foreach (var user in groupMembersWithGitHubIds)
                {
                    var result = await _gitHubFacade.IsUserMemberAsync(gitHubOrg, user.GitHubId);

                    if (result == MemberCheckResult.IsNotOrgMember)
                    {
                        await _gitHubFacade.AddOrgMemberAsync(gitHubOrg, user.GitHubId);
                        continue;
                    }

                    if (result == MemberCheckResult.UserIdDoesNotExist)
                    {
                        usersThatMayNotExist.Add(new GitHubUser
                        (
                            Email: user.Email,
                            GitHubId: user.GitHubId
                        ));
                        continue;
                    }

                    await _gitHubFacade.AddTeamMemberAsync(specificTeam.Id, user.GitHubId);
                }
            }

            return new GroupSyncResult(usersThatMayNotExist);
        }
    }
}
