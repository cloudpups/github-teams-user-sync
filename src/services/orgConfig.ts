export type GitHubTeamName = string;

export type ManagedGitHubTeam = {
    Name: GitHubTeamName,
    DisplayName?: string
    CopilotEnabled?: boolean
}

export type OrgConfigurationOptions = {
    GitHubTeamNames?: GitHubTeamName[]
    Teams?: ManagedGitHubTeam[]
    OrganizationMembersGroup?: GitHubTeamName | ManagedGitHubTeam
    OrganizationOwnersGroup?: GitHubTeamName | ManagedGitHubTeam
    AdditionalSecurityManagerGroups?:  ManagedGitHubTeam[] 
    AssumeMembershipViaTeams?: boolean
}

export class OrgConfig {
    private options: OrgConfigurationOptions;

    public OrgOwnersGroupName: string | undefined;
    public AdditionalSecurityManagerGroups: string[];
    public OrgMembersGroupName: string | undefined;
    public TeamsToManage: string[];
    public DisplayNameToSourceMap: Map<string,string>;
    public CopilotTeams: string[];

    constructor(options: OrgConfigurationOptions) {
        this.options = options;
        this.OrgOwnersGroupName = this.GetOrgOwnersGroupName();
        this.OrgMembersGroupName = this.GetOrganizationMembersGroupName();
        this.TeamsToManage = this.GetTeams();
        this.DisplayNameToSourceMap = this.GetSourceTeamMap();
        this.AdditionalSecurityManagerGroups = this.GetAdditionalSecurityManagerGroupNames();
        this.CopilotTeams = this.GetCopilotTeams();
    }
    
    private GetCopilotTeams(): string[] {
        return this.options.Teams?.filter(t => t.CopilotEnabled == true).map(t => t.DisplayName ?? t.Name) ?? [];
    }

    private GetAdditionalSecurityManagerGroupNames(): string[] {
        return (this.options.AdditionalSecurityManagerGroups ?? []).map(t => {
            return t.DisplayName ?? t.Name
        });
    }

    private GetOrgOwnersGroupName(): string | undefined {
        const group = this.options.OrganizationOwnersGroup;

        if (!group) {
            return undefined;
        }

        if (typeof group == "string") {
            return group;
        }

        return group.DisplayName ?? group.Name;
    }

    private GetOrganizationMembersGroupName(): string | undefined {
        const group = this.options.OrganizationMembersGroup;

        if (!group) {
            return undefined;
        }

        if (typeof group == "string") {
            return group;
        }

        return group.DisplayName ?? group.Name;
    }

    private GetTeams(): string[] {
        const list1 = (this.options.GitHubTeamNames ?? []);
        const list2 = (this.options.Teams ?? []).map(t => {
            return t.DisplayName ?? t.Name
        })
        const owners = this.GetOrgOwnersGroupName();
        const members = this.GetOrganizationMembersGroupName();

        const allSecurityMembers = this.GetAdditionalSecurityManagerGroupNames();

        return [
            ...list1,
            ...list2,
            ...allSecurityMembers,
            ...(owners != undefined ? [owners] : []),
            ...(members != undefined ? [members] : [])
        ];
    }

    private GetSourceTeamMap(): Map<string, string> {
        const owners = ConvertTeamToManagedTeam(this.options.OrganizationOwnersGroup);
        const members = ConvertTeamToManagedTeam(this.options.OrganizationMembersGroup);
        const allManaged = this.options.Teams ?? [];
        const allSecurityMembers = this.options.AdditionalSecurityManagerGroups ?? [];
        const allOther = !this.options.GitHubTeamNames ? [] : this.options.GitHubTeamNames.map(t => {
            return {
                Name: t,
                DisplayName: t
            } as ManagedGitHubTeam
        });

        const fullList = [
            ...(owners != undefined ? [owners] : []),
            ...(members != undefined ? [members] : []),
            ...allManaged,
            ...allOther,
            ...allSecurityMembers
        ];

        type DefinitelyHasDisplayName = {
            Name: string,
            DisplayName: string
        }

        const correctedArray: DefinitelyHasDisplayName[] = fullList.map(t => {
            return {
                Name: t.Name,
                DisplayName: t.DisplayName == undefined ? t.Name : t.DisplayName
            }
        });

        return new Map(correctedArray.map(t => [t.DisplayName, t.Name]));
    }
}

function ConvertTeamToManagedTeam(team: ManagedGitHubTeam | string | undefined): (ManagedGitHubTeam | undefined) {
    return !team ? undefined :
        typeof team == "string" ? { Name: team } :
            team;
}