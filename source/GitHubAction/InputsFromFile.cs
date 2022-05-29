namespace GitHubAction
{
    internal sealed class InputsFromFile
    {
        public string OrganizationMembersGroup { get; init; } = string.Empty;
        public IEnumerable<string> GitHubTeamNames { get; init; } = Enumerable.Empty<string>();
    }
}
