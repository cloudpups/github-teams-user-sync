namespace Gttsb.Core
{
    public interface IGroupSyncer
    {
        Task<GroupSyncResult> SyncronizeGroupsAsync(string gitHubOrg, IEnumerable<TeamDefinition> teamNames, bool createDeployment);
        Task<GroupSyncResult> SyncronizeMembersAsync(string gitHubOrg, TeamDefinition team);

        // Task<bool> RectifyTeamAsync(string name, IEnumerable<string> groupMemberEmailsAsGitHubMemberIds);
    }
}
