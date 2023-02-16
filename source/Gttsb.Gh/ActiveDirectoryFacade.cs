using Gttsb.Core;
using Microsoft.Graph;

namespace Gttsb.Gh
{
    public sealed class ActiveDirectoryFacade : IActiveDirectoryFacade
    {
        private readonly GraphServiceClient _graphServiceClient;
        private readonly AzureOptions _azureOptions;

        public ActiveDirectoryFacade(GraphServiceClient graphServiceClient, AzureOptions azureOptions)
        {
            _graphServiceClient = graphServiceClient;
            _azureOptions = azureOptions;
        }

        public async Task<MembersResponse> FetchMembersAsync(string groupDisplayName)
        {
            var groups = await _graphServiceClient.Groups
                .Request()
                .Filter($"displayName eq '{groupDisplayName}'")
                .Select("id,description")
                .Top(2)
                .GetAsync();

            if (groups.Count != 1)
            {
                // TODO: provide error code/response for "Too many groups of the same name!"
                return new MembersResponse(Success: false, Enumerable.Empty<Member>());
            }

            var groupInQuestion = groups[0];

            // TODO: do proper "string escape" here
            var filteredExtensionName = _azureOptions.ExtensionPropertyWithGitHubId.Replace(";", "").Replace(",", "").ReplaceLineEndings("").Replace(" ", "");
            var members = await _graphServiceClient.Groups[groupInQuestion.Id].Members
                .Request()                
                .Select($"id,mail,displayName,{filteredExtensionName}")
                .GetAsync();

            Func<User, Member> memberToUser = (User m) => {
                // TODO: handle exception case?

                if(m.AdditionalData == null)
                {
                    return new Member
                    (
                        DisplayName: m.DisplayName,
                        Email: m.Mail,
                        Id: m.Id,
                        PotentialGitHubId: string.Empty
                    );
                }

                if(m.AdditionalData.TryGetValue(filteredExtensionName, out var gitHubId))
                {                    
                    return new Member
                    (
                        DisplayName: m.DisplayName,
                        Email: m.Mail,
                        Id: m.Id,
                        PotentialGitHubId: gitHubId.ToString() ?? string.Empty
                    );
                }

                return new Member
                    (
                        DisplayName: m.DisplayName,
                        Email: m.Mail,
                        Id: m.Id,
                        PotentialGitHubId: string.Empty
                    );
            };

            var users = members.Select(m => memberToUser((User)m)).ToList();

            var nextMembersPage = members.NextPageRequest;
            while(nextMembersPage != null)
            {
                var moreMembers = await nextMembersPage.GetAsync();
                users.AddRange(moreMembers.Select(m => memberToUser((User)m)).ToList());
                nextMembersPage = moreMembers.NextPageRequest;
            }                                                    

            return new MembersResponse(Success: true, users);
        }
    }
}
