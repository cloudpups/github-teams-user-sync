namespace Gttsb.Core
{
    public interface IActiveDirectoryFacade
    {
        Task<MembersResponse> FetchMembersAsync(string name);
    }
}
