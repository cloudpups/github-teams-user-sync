using Gttsb.Core;
using Microsoft.Graph;

namespace Gttsb.Gh
{
    public sealed class ActiveDirectoryFacade : IActiveDirectoryFacade
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

            var members = await _graphServiceClient.Groups[groupInQuestion.Id].Members
                .Request()
                .Select("id,mail,displayName")
                .GetAsync();

            Func<User, Member> memberToUser = (User m) => {
                // TODO: handle exception case?
                var asUser = m;
                return new Member
                (
                    DisplayName: asUser.DisplayName,
                    Email: asUser.Mail,
                    Id: asUser.Id
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
