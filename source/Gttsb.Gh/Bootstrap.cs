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

            var productHeaderName = "groups-to-teams-sync";

            var client = new GitHubClient(new ProductHeaderValue(productHeaderName))
            {
                Credentials = tokenAuth
            };            

            var connection = new Octokit.GraphQL.Connection(new Octokit.GraphQL.ProductHeaderValue(productHeaderName), inputs.OrgAdministerToken);

            var gitHubFacade = new GitHubFacadeCacheDecorator(new InstalledGitHubFacade(client, connection, inputs.GitHubRepositoryOwner), new MemoryCache(new MemoryCacheOptions()));

            return gitHubFacade;
        }

        public static async Task<bool> StartTeamSyncAsync(IActiveDirectoryFacade activeDirectoryFacade, IInstalledGitHubFacade gitHubFacade)
        {
            var inputs = await gitHubFacade.GetConfigurationForInstallationAsync();

            if (!inputs.GitHubTeamNames.Any())
            {
                Console.WriteLine("No teams found to syncronize!");
                return false;
            }

            // Azure AD Group and GitHub Team Name must match (my opinion, baked into this tool)	
            var groupDisplayNames = inputs.GitHubTeamNames.Concat(new[] { inputs.OrganizationMembersGroup }).Distinct().ToDictionary(t => t);

            var org = gitHubFacade.OrgName;            

            var emailReplaceRules = GetEmailReplaceRules(inputs.EmailReplaceRules);
            var itemsToReplaceRules = GetItemsToReplaceRules(inputs.EmailTextToReplaceRules);

            var emailToCloudIdBuilder = EmailToCloudIdBuilder.Build(string.Empty, inputs.EmailAppend, itemsToReplaceRules, emailReplaceRules);

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

            return true;
        }

        private static IEnumerable<string> GetItemsToReplaceRules(IEnumerable<string> emailTextToReplaceRules)
        {
            // TODO: use proper config fetching here...
            var fromEnvAsString = Environment.GetEnvironmentVariable("EmailTextToReplaceRules") ?? "{}";

            var fromEnv = JsonConvert.DeserializeObject<IEnumerable<string>>(fromEnvAsString) ?? Enumerable.Empty<string>();

            return emailTextToReplaceRules.Any() ? emailTextToReplaceRules : fromEnv;
        }

        private static IReadOnlyDictionary<string, string> GetEmailReplaceRules(IReadOnlyDictionary<string, string> emailReplaceRules)
        {
            // TODO: use proper config fetching here...
            var fromEnvAsString = Environment.GetEnvironmentVariable("EmailReplaceRules") ?? "{}";

            var fromEnv = JsonConvert.DeserializeObject<IReadOnlyDictionary<string, string>>(fromEnvAsString) ?? new Dictionary<string,string>();

            return emailReplaceRules.Any() ? emailReplaceRules : fromEnv;
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
