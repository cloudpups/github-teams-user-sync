namespace Gttsb.Core
{
    [Obsolete("Use SyncInput instead")]
    public sealed record RenderedInput
    (
        string AzureTenantId,
        string AzureClientId,
        IEnumerable<string> GitHubTeamNames,
        string EmailPrepend,
        string EmailAppend,
        IReadOnlyList<string> EmailTextToReplace,
        string ConfigPath,
        string AzureClientSecret,
        string OrgAdministerToken,
        string GitHubRepositoryOwner,
        string OrganizationMembersGroup,
        bool CreateDeployment,
        IReadOnlyDictionary<string, string> EmailReplaceRules
    );
}
