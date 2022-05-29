namespace GitHubAction
{
    internal static class StringExtensions
    {

        internal static bool IsEmptyOrWhitespace(this string s) => string.IsNullOrWhiteSpace(s);
    }
}