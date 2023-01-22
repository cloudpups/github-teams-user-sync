using Gttsb.Core;
using Octokit;

namespace Gttsb.Gh
{
    public sealed partial class InstalledGitHubFacade : IInstalledGitHubFacade
    {
        private readonly GitHubClient gitHubClient;

        public InstalledGitHubFacade(GitHubClient gitHubClient)
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

        public async Task<MemberCheckResult> IsUserMemberAsync(string gitHubOrg, ValidGitHubId gitHubId)
        {
            return await gitHubClient.Organization.Member.CheckMember(gitHubOrg, gitHubId.Id) ? MemberCheckResult.IsMember : MemberCheckResult.IsNotOrgMember;            
        }

        public async Task<IReadOnlyDictionary<string, GitHubTeam>> GetAllTeamsAsync(string org)
        {
            // 100 is max page size via the API
            var pageSize = 100;            
            var currentPage = 0;

            var allTeams = new List<Octokit.Team>();
            IReadOnlyList<Octokit.Team> teams = new List<Octokit.Team>();

            // Wow a valid use of a 'Do While' loop
            do
            {                
                teams = await gitHubClient.Organization.Team.GetAll(org, new ApiOptions
                {
                    PageSize = pageSize,
                    StartPage = currentPage
                });
                currentPage++;
                allTeams.AddRange(teams);
            }
            while (teams.Count == 100);

            return allTeams.ToDictionary(t=> t.Name, t => new GitHubTeam(t.Id, t.Name));
        }

        public async Task AddTeamMemberAsync(GitHubTeam team, ValidGitHubId userGitHubId)
        {
            var updateMemberRequest = new UpdateTeamMembership(TeamRole.Member);
            await gitHubClient.Organization.Team.AddOrEditMembership(team.Id, userGitHubId.Id, updateMemberRequest);
        }

        public async Task<GitHubTeam> CreateTeamAsync(string gitHubOrg, string name)
        {
            var newTeam = await gitHubClient.Organization.Team.Create(gitHubOrg, new NewTeam(name)
            {
                Privacy = TeamPrivacy.Closed,
                Description = Statics.TeamDescription
            });

            return new GitHubTeam(newTeam.Id, newTeam.Name);
        }

        public async Task<ValidGitHubId?> DoesUserExistAsync(string gitHubId)
        {
            try
            {
                if(string.IsNullOrEmpty(gitHubId))
                    return null;

                var user = await gitHubClient.User.Get(gitHubId);
                return new ValidGitHubId(gitHubId);
            }
            catch (NotFoundException)
            {
                Console.WriteLine(string.Format("User {0} was not found", gitHubId));
                return null;
            }
        }

        public async Task<ICollection<ValidGitHubId>> ListCurrentMembersOfGitHubTeamAsync(GitHubTeam team)
        {
            var members = await gitHubClient.Organization.Team.GetAllMembers(team.Id);

            return members.Select(m => new ValidGitHubId(m.Login)).ToList();
        }

        public async Task RemoveTeamMemberAsync(GitHubTeam team, ValidGitHubId validUser)
        {
            await gitHubClient.Organization.Team.RemoveMembership(team.Id, validUser.Id);
        }

        public async Task UpdateTeamDetailsAsync(string gitHubOrg, GitHubTeam specificTeam, string description)
        {
            Console.WriteLine($"Updating {specificTeam.Id}:{specificTeam.Name}");

            await gitHubClient.Organization.Team.Update(specificTeam.Id, new UpdateTeam(specificTeam.Name)
            {
                Description = description,
                Privacy = TeamPrivacy.Closed
            });       
        }    

        public async Task<GhDeployment> CreateDeploymentAsync(string gitHubOrg)
        {
            var repo = ".github";

            // TODO: update NewDeployment to use the actual commit sha that was used in this sync
            var deployment = await gitHubClient.Repository.Deployment.Create(gitHubOrg, repo, new NewDeployment("main")
            {
                Environment = "GitHub Teams Sync"
            });

            return new GhDeployment(deployment.Id, gitHubOrg, repo);
        }      
        
        public async Task UpdateDeploymentAsync(GhDeployment deployment, GhDeployment.Status status)
        {
            var mappedStatus = status == GhDeployment.Status.Succeeded ? DeploymentState.Success : DeploymentState.Failure;

            await gitHubClient.Repository.Deployment.Status.Create(deployment.Org, deployment.Repo, deployment.Id, new NewDeploymentStatus(mappedStatus)
            {
                Description = "Teams have been synced!"
            });
        }
    }
}