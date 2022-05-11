using CommandLine;

namespace GitHubAction
{
    internal sealed class ActionInputs
    {               
        public ActionInputs()
        {
            if (Environment.GetEnvironmentVariable("ClientSecret") is { Length: > 0 } clientSecret)
            {
                ClientSecret = clientSecret;
            }
            else
            {
                throw new ArgumentNullException("ClientSecret must be set in environment variables!");
            }
            
            if (Environment.GetEnvironmentVariable("OrgAdministerToken") is { Length: > 0 } orgAdministerToken)
            {
                OrgAdministerToken = orgAdministerToken;
            }
            else
            {
                throw new ArgumentNullException("OrgAdministerToken must be set in environment variables!");
            }

            if (Environment.GetEnvironmentVariable("GITHUB_REPOSITORY_OWNER") is { Length: > 0 } gitHubRepositoryOwner)
            {
                GitHubRepositoryOwner = gitHubRepositoryOwner;
            }
            else
            {
                throw new ArgumentNullException("GITHUB_REPOSITORY_OWNER must be set in environment variables!");
            }            
        }

        [Option("tenantId",
            Required = true,
            HelpText = "The ID of the Azure AD Tenant that will be queried for group information.")]
        public string TenantId { get; init; } = "";

        [Option("clientId",
            Required = true,
            HelpText = "The ID of the Azure AD App Registration that will be used to query the Microsoft Graph.")]
        public string ClientId { get; init; } = "";

        // TODO: replace with gitHubTeamNames (plural)
        [Option("gitHubTeamNames",
            Required = true,
            HelpText = "The name of the GitHub Team to syncronize with Azure AD.",
            Separator = ';')]
        public IEnumerable<string> GitHubTeamNames { get; init; } = Enumerable.Empty<string>();

        [Option("emailPrepend",
            Required = false,
            HelpText = "Any text to prepend to Azure AD emails.")]
        public string EmailPrepend { get; init; } = "";

        [Option("emailAppend",
            Required = false,
            HelpText = "Any text to append to Azure AD emails.")]
        public string EmailAppend { get; init; } = "";

        [Option("emailTextToReplace",
            Required = false,
            HelpText = "Any text to replace in Azure AD emails. Semi-colon deliminated pairs seperated by commas.",
            Separator = ';')]
        public IReadOnlyList<string> EmailTextToReplace { get; init; } = new List<string>();

        public string ClientSecret { get; init; } = "";
        public string OrgAdministerToken { get; init; } = "";
        public string GitHubRepositoryOwner { get; init; } = "";
    }
}
