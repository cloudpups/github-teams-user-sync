﻿namespace Gttsb.Core
{
    internal sealed class EmailToCloudIdConverter : IEmailToCloudIdConverter
    {
        private readonly string emailPrepend;
        private readonly IEnumerable<string> itemsToReplace;
        private readonly string emailAppend;

        public EmailToCloudIdConverter(string emailPrepend, IEnumerable<string> itemsToReplace, string emailAppend)
        {
            this.emailPrepend = emailPrepend;
            this.itemsToReplace = itemsToReplace;
            this.emailAppend = emailAppend;
        }

        public string ToId(string email)
        {
            var replaceFunctions = itemsToReplace.SelectMany(s => s.Split(";")).Select(tr => tr.Split(",")).Select<string[], Func<string, string>>(tr => (string input) =>
            {
                return input.Replace(tr[0], tr[1]);
            }).ToList();

            var emailWithReplaceableItems = email;
            foreach (var replaceFunction in replaceFunctions)
            {
                emailWithReplaceableItems = replaceFunction(emailWithReplaceableItems);
            }

            return $"{emailPrepend}{emailWithReplaceableItems}{emailAppend}";
        }
    }
}
