namespace Gttsb.Core
{
    public static class EmailToCloudIdBuilder
    {
        public static IEmailToCloudIdConverter Build(string prepend, string append, IEnumerable<string> replaceString, IReadOnlyDictionary<string, string> emailReplaceRules)
        {
            return new EmailToCloudIdConverter(prepend, replaceString, emailReplaceRules, append);
        }
    }
}
