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

        public static async Task<bool> StartTeamSyncAsync(IActiveDirectoryFacade activeDirectoryFacade, IInstalledGitHubFacade gitHubFacade, AppOptions appOptions)
        {
            var inputs = await gitHubFacade.GetConfigurationForInstallationAsync();

            if (!inputs.GitHubTeamNames.Any())
            {
                Console.WriteLine("No teams found to syncronize!");
                return false;
            }

            // Azure AD Group and GitHub Team Name must match (my opinion, baked into this tool)	
            var securityManagers = inputs.SecurityManagerTeams.Concat(appOptions.SecurityManagerTeams).Distinct().ToList();
            var groupDisplayNames = inputs.GitHubTeamNames.Concat(new[] { inputs.OrganizationMembersGroup }).Concat(securityManagers).Distinct().ToDictionary(t => t);

            var org = gitHubFacade.OrgName;            

            var groupsToSyncronize = groupDisplayNames.Where(n => !string.IsNullOrWhiteSpace(n.Key))                
                .Where(n => !(n.Key == "NA" || n.Key == "na"))
                .Select(g => new
                {
                    Key = g.Key,
                    Value = new TeamDefinition("ActiveDirectory", g.Key)
                })
                .ToDictionary(o => o.Key, o => o.Value);

            Console.WriteLine("The sync tool will attempt to syncronize the following groups:");
            foreach (var group in groupsToSyncronize)
            {
                Console.WriteLine($"* {group.Key}");
            }

            var usersWithSyncIssues = new List<GitHubUser>();

            var groupSyncer = GroupSyncerBuilder.Build(activeDirectoryFacade, gitHubFacade, appOptions);

            if (securityManagers.Any())
            {
                var memberSyncResult = await groupSyncer.SyncronizeMembersAsync(org, securityManagers.Select(s => groupsToSyncronize[s]).ToArray());
                usersWithSyncIssues.AddRange(memberSyncResult.UsersWithSyncIssues);
            }

            if (!inputs.OrganizationMembersGroup.IsEmptyOrWhitespace())
            {
                var memberSyncResult = await groupSyncer.SyncronizeMembersAsync(org, groupsToSyncronize[inputs.OrganizationMembersGroup]);
                usersWithSyncIssues.AddRange(memberSyncResult.UsersWithSyncIssues);
            }

            var groupSyncResult = await groupSyncer.SyncronizeGroupsAsync(org, groupsToSyncronize.Values, inputs.CreateDeployment);

            usersWithSyncIssues.AddRange(groupSyncResult.UsersWithSyncIssues);

            if(securityManagers.Any())
            {
                // TODO: remove teams that are not defined in these settings.
                foreach (var securityManagerTeam in securityManagers)
                {
                    await gitHubFacade.AddSecurityManagerTeamAsync(securityManagerTeam);
                }                
            }

            WriteConsoleOutput(usersWithSyncIssues.DistinctBy(g => g.Email).ToHashSet());

            await Task.CompletedTask;

            return true;
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
