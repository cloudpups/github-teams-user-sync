namespace Gttsb.Core
{
    public interface IGroupSyncer
    {
        Task<GroupSyncResult> SyncronizeGroupsAsync(string gitHubOrg, IEnumerable<TeamDefinition> teamNames);

        // Task<bool> RectifyTeamAsync(string name, IEnumerable<string> groupMemberEmailsAsGitHubMemberIds);
    }
}
