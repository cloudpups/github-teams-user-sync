using Gttsb.Core;
using Newtonsoft.Json;
using Octokit;
using Octokit.GraphQL;
using YamlDotNet.Serialization;
using IGraphQlClient = Octokit.GraphQL.IConnection;

namespace Gttsb.Gh
{
    public sealed partial class InstalledGitHubFacade : IInstalledGitHubFacade
    {
        private readonly GitHubClient gitHubClient;
        private readonly IGraphQlClient graphQlClient;

        public string OrgName { get; }        

        public InstalledGitHubFacade(GitHubClient gitHubClient, IGraphQlClient graphQlClient, string orgName)
        {
            this.gitHubClient = gitHubClient;
            OrgName = orgName;
            this.graphQlClient = graphQlClient;
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
            var query = new Query().Organization(org).Teams().AllPages().Select(team => new {
                DatabaseId = team.DatabaseId ?? -1,
                team.Name,
                Members = team.Members(null, null, null, null, null, null, null, null).AllPages().Select(m => new {
                    m.Login,
                    m.Email
                }).ToList()
            }).Compile();

            var result = await graphQlClient.Run(query);

            return result.ToDictionary(t=> t.Name, t => new GitHubTeam(t.DatabaseId, t.Name, t.Members.Select(m => new GitHubUser(m.Email, new ValidGitHubId(m.Login))).ToList()), StringComparer.InvariantCultureIgnoreCase);
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

            // TODO: leaky- should not have to pass an empty array here. Could be improper shape for object
            return new GitHubTeam(newTeam.Id, newTeam.Name, Enumerable.Empty<GitHubUser>().ToList());       
        }

        public async Task<ValidGitHubId?> DoesUserExistAsync(string gitHubId)
        {
            try
            {
                var user = await gitHubClient.User.Get(gitHubId);
                return new ValidGitHubId(gitHubId);
            }
            catch (NotFoundException)
            {
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
            DeploymentState mappedStatus = MapStatus(status);

            await gitHubClient.Repository.Deployment.Status.Create(deployment.Org, deployment.Repo, deployment.Id, new NewDeploymentStatus(mappedStatus)
            {
                Description = "Teams have been synced! Please see the logs for more details.",
                LogUrl = "https://example.com"
            });
        }

        private static DeploymentState MapStatus(GhDeployment.Status status)
        {
            switch (status)
            {
                case GhDeployment.Status.Succeeded:
                    return DeploymentState.Success;
                case GhDeployment.Status.Failed:
                    return DeploymentState.Failure;
                case GhDeployment.Status.InProgress:
                    return DeploymentState.InProgress;
            }

            throw new Exception("Invalid status");
        }

        public async Task<SyncInput> GetConfigurationForInstallationAsync()
        {
            var files = await gitHubClient.Repository.Content.GetAllContents(this.OrgName, ".github");

            // TODO: allow for multiple configurations based on folders. Will require status checks to help with configuration
            // files though.
            var configurationFile = files.First(f => f.Path == "team-sync-options.yml" || f.Path ==  "team-sync-options.yaml");

            var configurationContent = await gitHubClient.Repository.Content.GetRawContent(this.OrgName, ".github", configurationFile.Path);

            var configurationAsString = System.Text.Encoding.Default.GetString(configurationContent);

            var deserializer = new DeserializerBuilder().Build();

            // TODO: fix this nonsense
            // https://github.com/aaubry/YamlDotNet/issues/571
            var rawYamlObject = deserializer.Deserialize<object>(configurationAsString);
            var syncInput = JsonConvert.DeserializeObject<SyncInput>(JsonConvert.SerializeObject(rawYamlObject));
            
            if(syncInput == null)
            {
                // TODO: throw proper custom exception
                throw new Exception("Configuration appears to be null");
            }

            // One could argue that such logic is too many responsibilities for this method. I pose this is a fine tradeoff though...
            // Once we get around to implementing config file status checks, I will most likely change my mind.
            // This could also be turned into a Set.
            var teamNames = syncInput.GitHubTeamNames ?? Enumerable.Empty<string>();
            syncInput = syncInput with
            {
                GitHubTeamNames = teamNames.Distinct().ToList()
            };

            return syncInput;
        }

        public async Task AddSecurityManagerTeamAsync(string existingTeamSlug)
        {            
            await gitHubClient.Connection.Put(new Uri($"{gitHubClient.Connection.BaseAddress}orgs/{OrgName}/security-managers/teams/{existingTeamSlug}"));
        }
    }
}
