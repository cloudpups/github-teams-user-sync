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
using Gttsb.Core;

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

await parser.WithParsedAsync(async options => 
{
	var configurationFromFile = await LoadConfigurationFromFileAsync(options.ConfigPath);

	var renderedInput = new RenderedInput(
		TenantId: options.TenantId,
		ClientId: options.ClientId,		
		GitHubTeamNames: options.GitHubTeamNames.Any() ? options.GitHubTeamNames : configurationFromFile.GitHubTeamNames,
		EmailPrepend: options.EmailPrepend,
		EmailAppend: options.EmailAppend,
		EmailTextToReplace: options.EmailTextToReplace,
		ConfigPath: options.ConfigPath,
		ClientSecret: options.ClientSecret,
		OrgAdministerToken: options.OrgAdministerToken,
		GitHubRepositoryOwner: options.GitHubRepositoryOwner
	);

	await StartTeamSyncAsync(renderedInput, host);
});

static async Task<InputsFromFile> LoadConfigurationFromFileAsync(string configPath)
{
	if(configPath.EndsWith(".json"))
    {
		var text = await System.IO.File.ReadAllTextAsync(configPath) ?? "";
		return JsonConvert.DeserializeObject<InputsFromFile>(text) ?? new InputsFromFile();
	}

	return new InputsFromFile();
}

await host.RunAsync();

static async Task StartTeamSyncAsync(RenderedInput inputs, IHost host)
{
	var tenantId = inputs.TenantId;
	var clientId = inputs.ClientId;
	var clientSecret = inputs.ClientSecret;

	var tokenAuth = new Credentials(inputs.OrgAdministerToken);

	// Azure AD Group and GitHub Team Name must match (my opinion, baked into this tool)	
	var groupDisplayNames = inputs.GitHubTeamNames;
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

    var client = new GitHubClient(new ProductHeaderValue("groups-to-teams-sync"))
    {
        Credentials = tokenAuth
    };
	var gitHubFacade = new GitHubFacade(client);

	var emailToCloudIdBuilder = EmailToCloudIdBuilder.Build(emailPrepend, emailAppend, itemsToReplace);

	var groupSyncer = GroupSyncerBuilder.Build(activeDirectoryFacade, gitHubFacade, emailToCloudIdBuilder);

	var groupsToSyncronize = groupDisplayNames.Select(g => new TeamDefinition("ActiveDirectory", g)).ToList();

	Console.WriteLine("This Action will attempt to syncronize the following groups:");
	foreach (var group in groupsToSyncronize)
    {
		Console.WriteLine($"* {group.Name}");
	}

	var groupSyncResult = await groupSyncer.SyncronizeGroupsAsync(org, groupsToSyncronize);

	var usersThatMayNotExist = groupSyncResult.UsersWithSyncIssues;

	if (usersThatMayNotExist.Any())
    {
		Console.WriteLine("################################################");
		Console.WriteLine();
		Console.WriteLine("This Action had issues with the following users:");
		Console.WriteLine();
		foreach (var user in usersThatMayNotExist)
        {
			Console.WriteLine($"{user.Email} ==> {user.GitHubId}");
		}
		Console.WriteLine();
		Console.WriteLine("################################################");
	}

	var formattedUsersThatMayNotExist = JsonConvert.SerializeObject(usersThatMayNotExist) ?? "";

	Console.WriteLine("Complete!");

	Console.WriteLine($"::set-output name=users-with-sync-issues::{formattedUsersThatMayNotExist}");

	await Task.CompletedTask;

    Environment.Exit(0);
}