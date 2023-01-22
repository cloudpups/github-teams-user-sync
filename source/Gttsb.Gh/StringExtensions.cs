namespace Gttsb.Gh
{
    public static class StringExtensions
    {

        public static bool IsEmptyOrWhitespace(this string s) => string.IsNullOrWhiteSpace(s);
    }
}