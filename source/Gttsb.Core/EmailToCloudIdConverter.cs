namespace Gttsb.Core
{
    internal sealed class EmailToCloudIdConverter : IEmailToCloudIdConverter
    {
        private readonly string emailPrepend;
        private readonly IEnumerable<string> itemsToReplace;
        private readonly IReadOnlyDictionary<string, string> emailReplaceRules;
        private readonly string defaultEmailReplace;

        public EmailToCloudIdConverter(string emailPrepend, IEnumerable<string> itemsToReplace, IReadOnlyDictionary<string,string> emailReplaceRules, string defaultEmailReplace)
        {
            this.emailPrepend = emailPrepend;
            this.itemsToReplace = itemsToReplace;
            this.emailReplaceRules = emailReplaceRules;
            this.defaultEmailReplace = defaultEmailReplace;
        }

        public string ToId(string email)
        {
            var splitEmail = email.Split("@");
            var nameComponent = splitEmail[0];
            var emailComponent = splitEmail[1];

            var replaceFunctions = itemsToReplace.SelectMany(s => s.Split(";")).Select(tr => tr.Split(",")).Select<string[], Func<string, string>>(tr => (string input) =>
            {
                return input.Replace(tr[0], tr[1]);
            }).ToList();

            var emailWithReplaceableItems = nameComponent;
            foreach (var replaceFunction in replaceFunctions)
            {
                emailWithReplaceableItems = replaceFunction(emailWithReplaceableItems);
            }

            if(emailReplaceRules.TryGetValue(emailComponent, out var replaceValue))
            {
                return $"{emailPrepend}{emailWithReplaceableItems}{replaceValue}";
            }

            // TODO: this will fail and it should fail. Replace this will actual failure message...
            return "";
        }
    }
}
