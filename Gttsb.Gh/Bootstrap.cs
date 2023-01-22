using Azure.Identity;
using Gttsb.Core;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Graph;
using Newtonsoft.Json;
using Octokit;

namespace Gttsb.Gh
{
    public static class Bootstrap
    {
        public static IInstalledGitHubFacade BuildInstalledFacade(RenderedInput inputs)
        {
            var tokenAuth = new Credentials(inputs.OrgAdministerToken);

            var client = new GitHubClient(new ProductHeaderValue("groups-to-teams-sync"))
            {
                Credentials = tokenAuth
            };

            var gitHubFacade = new GitHubFacadeCacheDecorator(new InstalledGitHubFacade(client, inputs.GitHubRepositoryOwner), new MemoryCache(new MemoryCacheOptions()));

            return gitHubFacade;
        }

        public static async Task StartTeamSyncAsync(RenderedInput inputs, IInstalledGitHubFacade gitHubFacade)
        {
            if (!inputs.GitHubTeamNames.Any())
            {
                Console.WriteLine("No teams found to syncronize!");
                Environment.Exit(0);
            }

            // Azure AD Group and GitHub Team Name must match (my opinion, baked into this tool)	
            var groupDisplayNames = inputs.GitHubTeamNames.Concat(new[] { inputs.OrganizationMembersGroup }).Distinct().ToDictionary(t => t);

            var tenantId = inputs.AzureTenantId;
            var clientId = inputs.AzureClientId;
            var clientSecret = inputs.AzureClientSecret;
           
            var org = inputs.GitHubRepositoryOwner;

            var emailPrepend = inputs.EmailPrepend;
            var itemsToReplace = inputs.EmailTextToReplace;
            var emailAppend = inputs.EmailAppend;

            // The client credentials flow requires that you request the
            // /.default scope, and preconfigure your permissions on the
            // app registration in Azure. An administrator must grant consent
            // to those permissions beforehand.
            var scopes = new[] { "https://graph.microsoft.com/.default" };
            // using Azure.Identity;
            var options = new TokenCredentialOptions
            {
                AuthorityHost = AzureAuthorityHosts.AzurePublicCloud
            };
            // https://docs.microsoft.com/dotnet/api/azure.identity.clientsecretcredential
            var clientSecretCredential = new ClientSecretCredential(
                tenantId, clientId, clientSecret, options);
            var graphClient = new GraphServiceClient(clientSecretCredential);
            var activeDirectoryFacade = new ActiveDirectoryFacade(graphClient);           

            var emailToCloudIdBuilder = EmailToCloudIdBuilder.Build(emailPrepend, emailAppend, itemsToReplace);

            var groupSyncer = GroupSyncerBuilder.Build(activeDirectoryFacade, gitHubFacade, emailToCloudIdBuilder);

            var groupsToSyncronize = groupDisplayNames.Select(g => new
            {
                Key = g.Key,
                Value = new TeamDefinition("ActiveDirectory", g.Key)
            }).ToDictionary(o => o.Key, o => o.Value);

            Console.WriteLine("This Action will attempt to syncronize the following groups:");
            foreach (var group in groupsToSyncronize)
            {
                Console.WriteLine($"* {group.Key}");
            }

            var usersWithSyncIssues = new List<GitHubUser>();

            if (!inputs.OrganizationMembersGroup.IsEmptyOrWhitespace())
            {
                var memberSyncResult = await groupSyncer.SyncronizeMembersAsync(org, groupsToSyncronize[inputs.OrganizationMembersGroup]);
                usersWithSyncIssues.AddRange(memberSyncResult.UsersWithSyncIssues);
            }

            var groupSyncResult = await groupSyncer.SyncronizeGroupsAsync(org, groupsToSyncronize.Values, inputs.CreateDeployment);

            usersWithSyncIssues.AddRange(groupSyncResult.UsersWithSyncIssues);

            WriteConsoleOutput(usersWithSyncIssues.DistinctBy(g => g.Email).ToHashSet());

            await Task.CompletedTask;

            Environment.Exit(0);
        }

        public static async Task StartTeamSyncAsync(IActiveDirectoryFacade activeDirectoryFacade, IInstalledGitHubFacade gitHubFacade)
        {
            var inputs = await gitHubFacade.GetConfigurationForInstallationAsync();

            if (!inputs.GitHubTeamNames.Any())
            {
                Console.WriteLine("No teams found to syncronize!");
                Environment.Exit(0);
            }

            // Azure AD Group and GitHub Team Name must match (my opinion, baked into this tool)	
            var groupDisplayNames = inputs.GitHubTeamNames.Concat(new[] { inputs.OrganizationMembersGroup }).Distinct().ToDictionary(t => t);

            var org = gitHubFacade.OrgName;
            
            var itemsToReplace = inputs.EmailTextToReplaceRules;            

            var emailToCloudIdBuilder = EmailToCloudIdBuilder.Build(string.Empty, string.Empty, itemsToReplace);

            var groupSyncer = GroupSyncerBuilder.Build(activeDirectoryFacade, gitHubFacade, emailToCloudIdBuilder);

            var groupsToSyncronize = groupDisplayNames.Select(g => new
            {
                Key = g.Key,
                Value = new TeamDefinition("ActiveDirectory", g.Key)
            }).ToDictionary(o => o.Key, o => o.Value);

            Console.WriteLine("This Action will attempt to syncronize the following groups:");
            foreach (var group in groupsToSyncronize)
            {
                Console.WriteLine($"* {group.Key}");
            }

            var usersWithSyncIssues = new List<GitHubUser>();

            if (!inputs.OrganizationMembersGroup.IsEmptyOrWhitespace())
            {
                var memberSyncResult = await groupSyncer.SyncronizeMembersAsync(org, groupsToSyncronize[inputs.OrganizationMembersGroup]);
                usersWithSyncIssues.AddRange(memberSyncResult.UsersWithSyncIssues);
            }

            var groupSyncResult = await groupSyncer.SyncronizeGroupsAsync(org, groupsToSyncronize.Values, inputs.CreateDeployment);

            usersWithSyncIssues.AddRange(groupSyncResult.UsersWithSyncIssues);

            WriteConsoleOutput(usersWithSyncIssues.DistinctBy(g => g.Email).ToHashSet());

            await Task.CompletedTask;

            Environment.Exit(0);
        }

        static void WriteConsoleOutput(ISet<GitHubUser> usersWithSyncIssues)
        {
            if (usersWithSyncIssues.Any())
            {
                Console.WriteLine("################################################");
                Console.WriteLine();
                Console.WriteLine("There were issues with the following users:");
                Console.WriteLine();
                foreach (var user in usersWithSyncIssues)
                {
                    Console.WriteLine($"{user.Email} ==> {user.GitHubId}");
                }
                Console.WriteLine();
                Console.WriteLine("################################################");
            }

            var formattedUsersWithSyncIssues = JsonConvert.SerializeObject(usersWithSyncIssues) ?? "";

            Console.WriteLine("Complete!");

            Console.WriteLine($"::set-output name=users-with-sync-issues::{formattedUsersWithSyncIssues}");
        }
    }
}
