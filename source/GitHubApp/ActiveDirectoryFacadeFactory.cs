using Azure.Identity;
using Gttsb.Core;
using Gttsb.Gh;
using Microsoft.Extensions.Options;
using Microsoft.Graph;

internal class ActiveDirectoryFacadeFactory : IActiveDirectoryFacadeFactory
{
    private readonly IOptions<AzureOptions> azureOptions;

    public ActiveDirectoryFacadeFactory(IOptions<AzureOptions> azureOptions)
    {
        this.azureOptions = azureOptions;
    }

    public IActiveDirectoryFacade GetActiveDirectoryClient()
    {
        var tenantId = azureOptions.Value.TenantId;
        var clientId = azureOptions.Value.ClientId;
        var clientSecret = azureOptions.Value.ClientSecret;      

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

        return activeDirectoryFacade;
    }
}