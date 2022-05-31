namespace Gttsb.Core
{
    public sealed record GitHubUserCheckResult(MemberCheckResult Status, ValidGitHubId? UserIfFound);
}
