namespace Gttsb.Gh
{
    public sealed class AppOptions
    {
        public string PrivateKey { get; init; }
        public string AppId { get; init; }
        public IReadOnlyDictionary<string, string> EmailReplaceRules { get; init; }
        public IEnumerable<string> EmailTextToReplaceRules { get; init; }
    }
}
