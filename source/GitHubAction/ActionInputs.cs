namespace GitHubAction
{
    internal sealed class InputsFromFile
    {                     
        public string TenantId { get; init; } = "";
        public string ClientId { get; init; } = "";
        public IEnumerable<string> GitHubTeamNames { get; init; } = Enumerable.Empty<string>();
        public string EmailPrepend { get; init; } = "";
        public string EmailAppend { get; init; } = "";
        public IReadOnlyList<string> EmailTextToReplace { get; init; } = new List<string>();
    }
}
