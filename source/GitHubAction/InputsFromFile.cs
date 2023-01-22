namespace GitHubAction
{
    internal sealed class InputsFromFile
    {
        public string OrganizationMembersGroup { get; init; } = string.Empty;
        public IEnumerable<string> GitHubTeamNames { get; init; } = Enumerable.Empty<string>();
        [Obsolete("DO NOT USE")]
        public bool CreateDeployment { get; init; } = false;
        [Obsolete("DO NOT USE")]
        public string EmailAppend { get; init; } = string.Empty;
        [Obsolete("DO NOT USE")]
        public IEnumerable<string> EmailTextToReplaceRules { get; init; } = Enumerable.Empty<string>();
    }
}
