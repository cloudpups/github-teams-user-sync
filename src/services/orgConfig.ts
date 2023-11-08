export type GitHubTeamName = string;

export type ManagedGitHubTeam = {
    Name: GitHubTeamName,
    DisplayName?: string
}

export type OrgConfigurationOptions = {
    GitHubTeamNames?: string[]
    Teams?: ManagedGitHubTeam[]
    OrganizationMembersGroup?: string | ManagedGitHubTeam
    OrganizationOwnersGroup?: string | ManagedGitHubTeam
}

export class OrgConfig {
    private options:OrgConfigurationOptions;

    constructor(options:OrgConfigurationOptions) {
        this.options = options;
    }    

    public GetOrgOwnersGroupName() : string | undefined {
        const group = this.options.OrganizationOwnersGroup;

        if(!group) {
            return undefined;
        }

        if(typeof group == "string") {
            return group;
        }

        return group.DisplayName ?? group.Name;
    }

    public GetOrganizationMembersGroupName() : string | undefined {
        const group = this.options.OrganizationMembersGroup;

        if(!group) {
            return undefined;
        }

        if(typeof group == "string") {
            return group;
        }

        return group.DisplayName ?? group.Name;
    }

    public GetTeams() : string[] {
        const list1 = (this.options.GitHubTeamNames ?? []);
        const list2 = (this.options.Teams ?? []).map(t => {
            return t.DisplayName ?? t.Name
        })        

        return list1.concat(list2);
    }
}