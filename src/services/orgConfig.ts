export type GitHubTeamName = string;

export type ManagedGitHubTeam = {
    Name: GitHubTeamName,
    DisplayName?: string
}

export type OrgConfiguration = {
    GitHubTeamNames?: string[]
    Teams?: ManagedGitHubTeam[]
    OrganizationMembersGroup?: string
    OrganizationOwnersGroup?: string | ManagedGitHubTeam
}