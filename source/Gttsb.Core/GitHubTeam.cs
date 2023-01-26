namespace Gttsb.Core
{
    public record GitHubTeam(int Id, string Name, IReadOnlyCollection<GitHubUser> Members);
}