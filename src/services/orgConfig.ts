export type GitHubTeamName = string;

export type ManagedGitHubTeam = {
    Name: GitHubTeamName,
    DisplayName?: string
}

export type OrgConfigurationOptions = {
    GitHubTeamNames?: string[]
    Teams?: ManagedGitHubTeam[]
    OrganizationMembersGroup?: string
    OrganizationOwnersGroup?: string | ManagedGitHubTeam
}

export class OrgConfig {
    private options:OrgConfigurationOptions;

    constructor(options:OrgConfigurationOptions) {
        this.options = options;
    }

    public GetOrgOwnersGroupName() {

    }

    public GetOrganizationMembersGroupName() {

    }

    public GetTeams() {
        const mappedTeams = (this.options.GitHubTeamNames ?? []).map(t => {
            const team : ManagedGitHubTeam = {
                Name: t,
                DisplayName: undefined
            }

            return team;
        });

        const fullArray = (this.options.Teams ?? []).concat(...mappedTeams);

        return fullArray;
    }
}