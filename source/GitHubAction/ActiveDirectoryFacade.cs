using Gttsb.Core;
using Microsoft.Graph;

namespace GitHubAction
{
    internal sealed class ActiveDirectoryFacade : IActiveDirectoryFacade
    {
        private readonly GraphServiceClient _graphServiceClient;

        public ActiveDirectoryFacade(GraphServiceClient graphServiceClient)
        {
            _graphServiceClient = graphServiceClient;
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

            // TODO: Make sure to page!!
            // Not paging will make this not truly work...
            var members = await _graphServiceClient.Groups[groupInQuestion.Id].Members
                .Request()
                .Select("id,mail,displayName")
                .GetAsync();

            var users = members.Select(m =>
            {
                // TODO: handle exception case?
                var asUser = (User)m;
                return new Member
                (
                    DisplayName: asUser.DisplayName,
                    Email: asUser.Mail,
                    Id: asUser.Id
                );
            });

            return new MembersResponse(Success: true, users); ;
        }
    }
}
