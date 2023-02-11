namespace Gttsb.Core
{
    public sealed class AppOptions
    {
        public string[] SecurityManagerTeams { get; init; } = Array.Empty<string>();
        // TODO: add custom builder for IReadOnlyDictionary?
        // I am fairly annoyed that the default WebHostBuilder doesn't seem to be able 
        // to pull in env vars as dictionaries when using IReadOnlyDictionary...
        // Perhaps it is user error on Josh's part.
        public Dictionary<string, string> EmailReplaceRules { get; init; } = new Dictionary<string, string>();
        public string[] EmailTextToReplaceRules { get; init; } = Array.Empty<string>();
        public string GitHubIdAppend { get; init; } = string.Empty;
    }
}
