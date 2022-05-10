namespace Gttsb.Core
{
    public record GroupSyncResult(IEnumerable<GitHubUser> UsersWithSyncIssues);
}