namespace GitHubAction
{
    internal record RenderedInput
    (
        string TenantId,
        string ClientId,
        IEnumerable<string> GitHubTeamNames,
        string EmailPrepend,
        string EmailAppend,
        IReadOnlyList<string> EmailTextToReplace,
        string ConfigPath,
        string ClientSecret,
        string OrgAdministerToken,
        string GitHubRepositoryOwner,
        string OrganizationMembersGroup,
        bool CreateDeployment
    );
}
