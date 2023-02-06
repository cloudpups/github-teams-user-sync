namespace Gttsb.Core
{
    internal sealed class GroupSyncer : IGroupSyncer
    {
        private readonly IActiveDirectoryFacade _activeDirectoryFacade;
        private readonly IInstalledGitHubFacade _gitHubFacade;
        private readonly IEmailToCloudIdConverter _emailToGitHubIdConverter;

        public GroupSyncer(IActiveDirectoryFacade activeDirectoryFacade, IInstalledGitHubFacade gitHubFacade, IEmailToCloudIdConverter emailToCloudIdConverter)
        {
            _activeDirectoryFacade = activeDirectoryFacade;
            _gitHubFacade = gitHubFacade;
            _emailToGitHubIdConverter = emailToCloudIdConverter;
        }

        public Task<GroupSyncResult> SyncronizeGroupsAsync(string gitHubOrg, IEnumerable<TeamDefinition> teams, bool createDeployment) => SyncronizeGroupsAsync(gitHubOrg, teams, true, createDeployment);

        public async Task<GroupSyncResult> SyncronizeMembersAsync(string gitHubOrg, params TeamDefinition[] teams)
        {
            var usersWithSyncIssues = new List<GitHubUser>();
            var teamSyncFailures = new List<string>();
            foreach (var team in teams)
            {
                var (status, validUsers, usersWithSyncIssuesToAdd) = await GetValidUsersForTeamAsync(team.Name, gitHubOrg);

                if(!status)
                {
                    teamSyncFailures.Add(team.Name);
                    // must continue trying to add
                    continue;
                }

                usersWithSyncIssues.AddRange(usersWithSyncIssuesToAdd);

                // Add user to org if necessary
                foreach (var validUser in validUsers)
                {
                    var result = await _gitHubFacade.IsUserMemberAsync(gitHubOrg, validUser);

                    if (result == MemberCheckResult.IsNotOrgMember)
                    {
                        var addStatus = await _gitHubFacade.AddOrgMemberAsync(gitHubOrg, validUser);
                    }
                }
            }

            return new GroupSyncResult(usersWithSyncIssues);
        }

        // TODO: clean this up... This method could be doing too much.
        private async Task<GroupSyncResult> SyncronizeGroupsAsync(string gitHubOrg, IEnumerable<TeamDefinition> teamsControlledBySyncer, bool addMembers = false, bool createDeployment = false)
        {
            GhDeployment? deployment = null;
            if(createDeployment)
            {
                deployment = await _gitHubFacade.CreateDeploymentAsync(gitHubOrg);

                await _gitHubFacade.UpdateDeploymentAsync(deployment, GhDeployment.Status.InProgress);
            }
                       
            var teamSyncFailures = new List<string>();
            var usersWithSyncIssues = new List<GitHubUser>();

            // TODO: would be better to have a _gitHubTeamService expose a method of GetTeamDetailsAsync
            // where if would retrieve or create a team and return the details of that instead of exposing
            // GetAllTeams and having this GroupSyncer have the responsibility of filtering the teams
            // and using them here.
            var allTeams = await _gitHubFacade.GetAllTeamsAsync(gitHubOrg);

            Console.WriteLine($"{allTeams.Count} teams already exist in the {gitHubOrg} organization:");
            foreach(var team in allTeams)
            {
                Console.WriteLine($"* {team.Key}");
            }

            if(allTeams == null)
            {
                return new GroupSyncResult(Enumerable.Empty<GitHubUser>());
            }

            foreach (var team in teamsControlledBySyncer)
            {
                if(!allTeams.TryGetValue(team.Name, out var specificTeam))
                {
                    Console.WriteLine($"Creating team {team.Name}");
                    specificTeam = await _gitHubFacade.CreateTeamAsync(gitHubOrg, team.Name);
                }

                if(specificTeam == null)
                {
                    // TODO: return failure here as the Team MUST exist
                    continue;
                }

                await _gitHubFacade.UpdateTeamDetailsAsync(gitHubOrg, specificTeam, Statics.TeamDescription);

                var (status, validUsersForTeam, usersWithSyncIssuesToAdd) = await GetValidUsersForTeamAsync(specificTeam.Name, gitHubOrg);

                if(!status)
                {
                    teamSyncFailures.Add(team.Name);
                    continue;
                }

<<<<<<< HEAD
                var groupMembersWithGitHubIds = membersResponse.Members.Select(m => new
                {
                    m.Id,
                    m.DisplayName,
                    m.Email,
                    GitHubId = _emailToGitHubIdConverter.ToId(m.Email)
                }).Where(u => !string.IsNullOrWhiteSpace(u.GitHubId)).ToList();

                // Check if user is valid
                var validUsersForTeam = new List<ValidGitHubId>();
                foreach(var user in groupMembersWithGitHubIds)
                {
                    var validUser = await _gitHubFacade.DoesUserExistAsync(user.GitHubId);

                    if (validUser == null)
                    {
                        usersWithSyncIssues.Add(new GitHubUser
                        (
                            Email: user.Email,
                            GitHubId: new ValidGitHubId(user.GitHubId)
                        ));
                        continue;
                    }
                    validUsersForTeam.Add(validUser);
                }

                // Add user to org if necessary
                foreach(var validUser in validUsersForTeam)
                {
                    var result = await _gitHubFacade.IsUserMemberAsync(gitHubOrg, validUser);

                    if (result == MemberCheckResult.IsNotOrgMember)
                    {
                        var status = await _gitHubFacade.AddOrgMemberAsync(gitHubOrg, validUser);
                    }                    
                }
=======
                usersWithSyncIssues.AddRange(usersWithSyncIssuesToAdd);
>>>>>>> 2820b7b (:bulb: :bug: allow multiple membership groups)

                var existingMembers = specificTeam.Members.Select(m => m.GitHubId).ToList();
                var membersToRemove = existingMembers.Except(validUsersForTeam).ToList();
                var membersToAdd = validUsersForTeam.Except(existingMembers).ToList();

                // Add user to Team
                foreach (var validUser in membersToAdd)
                {                    
                    await _gitHubFacade.AddTeamMemberAsync(specificTeam, validUser);                                                          
                }

                foreach (var validUser in membersToRemove)
                {
                    await _gitHubFacade.RemoveTeamMemberAsync(specificTeam, validUser);
                }
            }

            if(deployment != null)
            {
                await _gitHubFacade.UpdateDeploymentAsync(deployment, GhDeployment.Status.Succeeded);
            }            

            return new GroupSyncResult(usersWithSyncIssues);
        }

        private async Task<(bool Status, IEnumerable<ValidGitHubId> IDs, IEnumerable<GitHubUser> UsersWithSyncIssues)> GetValidUsersForTeamAsync(string teamName, string gitHubOrg)
        {
            var membersResponse = await _activeDirectoryFacade.FetchMembersAsync(teamName);

            if (!membersResponse.Success)
            {
                return (false, Enumerable.Empty<ValidGitHubId>(), Enumerable.Empty<GitHubUser>());
            }

            var groupMembersWithGitHubIds = membersResponse.Members.Select(m => new
            {
                m.Id,
                m.DisplayName,
                m.Email,
                GitHubId = _emailToGitHubIdConverter.ToId(m.Email)
            });

            // Check if user is valid
            var validUsersForTeam = new List<ValidGitHubId>();
            var usersWithSyncIssues = new List<GitHubUser>();
            foreach (var user in groupMembersWithGitHubIds)
            {
                var validUser = await _gitHubFacade.DoesUserExistAsync(user.GitHubId);

                if (validUser == null)
                {
                    usersWithSyncIssues.Add(new GitHubUser
                    (
                        Email: user.Email,
                        GitHubId: new ValidGitHubId(user.GitHubId)
                    ));
                    continue;
                }
                validUsersForTeam.Add(validUser);
            }   

            return (true, validUsersForTeam, usersWithSyncIssues);
        }        
    }
}
