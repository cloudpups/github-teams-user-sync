namespace GitHubApp.Models
{
    public sealed class SyncResult
    {
        public bool Succeeded { get; init; }
        public string OrgName { get; init; } = string.Empty;
    }
}
