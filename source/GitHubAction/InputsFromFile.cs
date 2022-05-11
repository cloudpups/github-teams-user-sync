namespace GitHubAction
{
    internal sealed class InputsFromFile
    {                     
        public IEnumerable<string> GitHubTeamNames { get; init; } = Enumerable.Empty<string>();
    }
}
