namespace Gttsb.Core
{
    public sealed record SyncInput
    {
        public IEnumerable<string> GitHubTeamNames { get; init; } = Enumerable.Empty<string>();
        public string EmailAppend { get; init; } = String.Empty;
        public IEnumerable<string> EmailTextToReplaceRules { get; init; } = Enumerable.Empty<string>();
        public string OrganizationMembersGroup { get; init; } = String.Empty;
        public bool CreateDeployment { get; init; } = true;
        public IReadOnlyDictionary<string, string> EmailReplaceRules { get; init; } = new Dictionary<string, string>();
        public string[] SecurityManagerTeams { get; init; } = Array.Empty<string>();
    };
}
