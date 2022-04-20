using CommandLine;
using GitHubAction.Extensions;
using GitHubAction;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using static CommandLine.Parser;
using Octokit;
using Azure.Identity;
using Microsoft.Graph;
using Newtonsoft.Json;

using IHost host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((_, services) => services.AddGitHubActionServices())
    .Build();

static TService Get<TService>(IHost host)
    where TService : notnull =>
    host.Services.GetRequiredService<TService>();

var parser = Default.ParseArguments<ActionInputs>(() => new(), args);
parser.WithNotParsed(
    errors =>
    {
        Get<ILoggerFactory>(host)
            .CreateLogger("GitHubAction.Program")
            .LogError(
                string.Join(
                    Environment.NewLine, errors.Select(error => error.ToString())));

        Environment.Exit(2);
    });

await parser.WithParsedAsync(options => StartTeamSyncAsync(options, host));
await host.RunAsync();

static async Task StartTeamSyncAsync(ActionInputs inputs, IHost host)
{
	var tenantId = inputs.TenantId;
	var clientId = inputs.ClientId;
	var clientSecret = inputs.ClientSecret;

	var tokenAuth = new Credentials(inputs.OrgAdministerToken);

	// Azure AD Group and GitHub Team Name must match (my opinion, baked into this tool)
	var groupDisplayName = inputs.GitHubTeamName;
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

	var groups = await graphClient.Groups
		.Request()
		.Filter($"displayName eq '{groupDisplayName}'")
		.Select("id,description")
		.Top(2)
		.GetAsync();

	if (groups.Count != 1)
	{
		// throw error
		return;
	}

	var groupInQuestion = groups[0];

	// TODO: Make sure to page!!
	var members = await graphClient.Groups[groupInQuestion.Id].Members
		.Request()
		.Select("id,mail,displayName")
		.GetAsync();

	var replaceFunctions = itemsToReplace.Split(";").Select(tr => tr.Split(",")).Select<string[], Func<string, string>>(tr => (string input) =>
	{
		return input.Replace(tr[0], tr[1]);
	}).ToList();

    string cloudIdConverter(string email)
    {
        var emailWithReplaceableItems = email;
        foreach (var replaceFunction in replaceFunctions)
        {
            emailWithReplaceableItems = replaceFunction(emailWithReplaceableItems);
        }

        return $"{emailPrepend}{emailWithReplaceableItems}{emailAppend}";
    }

    var users = members.Select(m => {
		var asUser = (Microsoft.Graph.User)m;
		return new
		{
            asUser.Id,
			Email = asUser.Mail,
			GitHubId = cloudIdConverter(asUser.Mail),
            asUser.DisplayName
		};
	}
	);

    var client = new GitHubClient(new ProductHeaderValue("groups-to-teams-sync"))
    {
        Credentials = tokenAuth
    };

    var allTeams = await client.Organization.Team.GetAll(org);

	var specificTeam = allTeams.First(t => t.Name == groupDisplayName);

	var usersThatMayNotExist = new List<(string, string)>();
	foreach (var user in users)
	{
		try
		{
			var userIsMember = await client.Organization.Member.CheckMember(org, user.GitHubId);

			if (!userIsMember)
			{
				var orgMembershipUpdate = new OrganizationMembershipUpdate();
				var response = await client.Organization.Member.AddOrUpdateOrganizationMembership(org, user.GitHubId, orgMembershipUpdate);
			}

			var updateMemberRequest = new UpdateTeamMembership(TeamRole.Member);
			var addMemberResponse = await client.Organization.Team.AddOrEditMembership(specificTeam.Id, user.GitHubId, updateMemberRequest);
		}
		catch (NotFoundException)
		{
			usersThatMayNotExist.Add((user.GitHubId, user.Email));
		}
	}

	var formattedUsersThatMayNotExist = JsonConvert.SerializeObject(usersThatMayNotExist);
	Console.WriteLine(formattedUsersThatMayNotExist);
	Console.WriteLine($"::set-output name=users-with-sync-issues::{formattedUsersThatMayNotExist}");

    await Task.CompletedTask;

    Environment.Exit(0);
}