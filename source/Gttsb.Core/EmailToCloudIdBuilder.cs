namespace Gttsb.Core
{
    public static class EmailToCloudIdBuilder
    {
        public static IEmailToCloudIdConverter Build(string prepend, string append, IEnumerable<string> replaceString)
        {
            return new EmailToCloudIdConverter(prepend, replaceString, append);
        }
    }
}
