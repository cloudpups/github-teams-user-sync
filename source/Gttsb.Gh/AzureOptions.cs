namespace Gttsb.Gh
{
    public sealed class AzureOptions
    {
        public string ClientId { get; set; } = string.Empty;
        public string ClientSecret { get; set; } = string.Empty;
        public string TenantId { get; set; } = string.Empty;
        public string ExtensionPropertyWithGitHubId { get; init; } = string.Empty;
    }
}
