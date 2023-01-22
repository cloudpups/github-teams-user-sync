using CommandLine;
using GitHubAction.Extensions;
using GitHubAction;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using static CommandLine.Parser;
using Newtonsoft.Json;
using Gttsb.Core;
using YamlDotNet.Serialization;
using Gttsb.Gh;

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
    InputsFromFile configurationFromFile = null;
    if(!string.IsNullOrEmpty(options.ConfigPath))
    {
	    configurationFromFile = await LoadConfigurationFromFileAsync(options.ConfigPath);
    }

	if(configurationFromFile == null)
    {
		throw new Exception("Unable to load configuration");
    }

	var renderedInput = new RenderedInput(
		AzureTenantId: options.TenantId,
		AzureClientId: options.ClientId,		
		GitHubTeamNames: options.GitHubTeamNames.IsEmptyOrContainsOneBlankString() ? configurationFromFile.GitHubTeamNames : options.GitHubTeamNames,
		EmailPrepend: options.EmailPrepend,
		EmailAppend: options.EmailAppend,
		EmailTextToReplace: options.EmailTextToReplace,
		ConfigPath: options.ConfigPath,
		AzureClientSecret: options.ClientSecret,
		OrgAdministerToken: options.OrgAdministerToken,
		GitHubRepositoryOwner: options.GitHubRepositoryOwner,
		OrganizationMembersGroup: options.OrganizationMembersGroup.IsEmptyOrWhitespace() ? configurationFromFile.OrganizationMembersGroup : options.OrganizationMembersGroup,
        CreateDeployment: options.CreateDeployment
	);	

	await Bootstrap.StartTeamSyncAsync(renderedInput, Bootstrap.BuildInstalledFacade(renderedInput));
});

static async Task<InputsFromFile> LoadConfigurationFromFileAsync(string configPath)
{
	var text = await System.IO.File.ReadAllTextAsync(configPath) ?? "";

	if (configPath.EndsWith(".json"))
    {		
		return JsonConvert.DeserializeObject<InputsFromFile>(text) ?? new InputsFromFile();
	}

	if(configPath.EndsWith(".yml") || configPath.EndsWith(".yaml"))
    {
		var deserializer = new DeserializerBuilder().Build();

		return deserializer.Deserialize<InputsFromFile>(text) ?? new InputsFromFile();
	}

	return new InputsFromFile();
}

await host.RunAsync();