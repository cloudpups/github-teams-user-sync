import { AppConfig } from "./appConfig";
import { CopilotAddResponse, GitHubId, IInstalledClient, OrgInvite } from "./gitHubTypes";
import { IGitHubInvitations } from "./githubInvitations";
import { OrgConfig } from "./orgConfig";

interface IGitHubSyncer {
    getCurrentOrgName(): string;
    initializeResponse(orgName: string): ReturnTypeOfSyncOrg;
    listCurrentInvitations(): Promise<OrgInvite[]>;
    getAllExistingTeams(): Promise<Set<string>>;
    getOrganizationConfiguration(): Promise<OrgConfig>;
    syncSecurityManagerTeams(currentInvites: OrgInvite[], securityManagerTeams: string[], setOfExistingTeams: Set<string>, shortLink: string, displayNameToSourceMap: Map<string, string>): Promise<SuccessSync | FailedSecSync>;
    handleOrganizationConfigurationErrors(orgConfigResponse: any, response: ReturnTypeOfSyncOrg): ReturnTypeOfSyncOrg;
    createMissingTeams(orgName: string, teamsToCreate: string[], shortLink: string): Promise<void>;
    syncOrganizationMembersByTeam(teamName: string, sourceTeamMap: Map<string, string>): Promise<void>;
    syncOrganizationMembersGroup(membersGroupName: string, orgConfig: OrgConfig, currentInvites: OrgInvite[]): Promise<GitHubId[]>;
    syncGitHubTeams(gitHubTeams: string[], currentInvites: OrgInvite[], orgConfig: OrgConfig): Promise<void>;
    syncOrganizationOwners(ownerGroupName: string, response: ReturnTypeOfSyncOrg): Promise<ReturnTypeOfSyncOrg>;
    addCopilotSubscriptions(orgConfig: OrgConfig, response: ReturnTypeOfSyncOrg): Promise<ReturnTypeOfSyncOrg>;
}

class GitHubSyncer implements IGitHubSyncer {
    constructor(
        private installedGitHubClient: IInstalledClient,
        private invitationsClient: IGitHubInvitations,
        private appConfig: AppConfig
    ) { }

    getCurrentOrgName(): string {
        return this.installedGitHubClient.GetCurrentOrgName();
    }

    initializeResponse(orgName: string): ReturnTypeOfSyncOrg {
        return {
            message: `Initializing sync for organization: ${orgName}`,
            status: "completed",
            orgName: orgName,
            syncedSecurityManagerTeams: [],
            orgOwnersGroup: "",
            ignoredTeams: [],
            copilotTeams: []
        };
    }

    async listCurrentInvitations(): Promise<OrgInvite[]> {
        const invites = await this.invitationsClient.ListInvites();
        if (!invites.successful) {
            throw new Error("Invalid response from ListInvites");
        }
        return invites.data;
    }

    async getAllExistingTeams(): Promise<Set<string>> {
        const teams = await this.installedGitHubClient.GetAllTeams();
        if (!teams.successful) {
            throw new Error("Invalid response from GetAllTeams");
        }
        return new Set(teams.data.map(team => team.Name));
    }

    async getOrganizationConfiguration(): Promise<OrgConfig> {
        const orgConfigResponse = await this.installedGitHubClient.GetConfigurationForInstallation();
        if (!orgConfigResponse.successful) {
            throw new Error("Invalid response from GetOrgConfig");
        }
        return orgConfigResponse.data;
    }

    async syncSecurityManagerTeams(currentInvites: OrgInvite[], securityManagerTeams: string[], setOfExistingTeams: Set<string>, shortLink: string, displayNameToSourceMap: Map<string, string>): Promise<SuccessSync | FailedSecSync> {
        const orgName = this.getCurrentOrgName();

        for (const t of securityManagerTeams) {
            if (!setOfExistingTeams.has(t.toUpperCase())) {
                // Log(`Creating team '${orgName}/${t}'`)
                await this.installedGitHubClient.CreateTeam(t, teamDescription(shortLink, t));
                setOfExistingTeams.add(t);
            }

            // Log(`Syncing Security Managers for ${installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            const orgMembers = await this.syncOrganizationMembersByTeam(t, this.appConfig, displayNameToSourceMap);

            if (orgMembers.Succeeded == false) {
                return {
                    Success: false,
                    Message: "Failed to sync org members"
                };
            }


            await SynchronizeGitHubTeam(installedGitHubClient, t, appConfig, currentInvites, displayNameToSourceMap);

            Log(`Add Security Manager Team for ${installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            const addResult = await installedGitHubClient.AddSecurityManagerTeam(t);
            if (addResult) {
                Log(`Added Security Manager Team for ${installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            }
        }

        return {
            Success: true,
            SyncedSecurityManagerTeams: securityManagerTeams
        }
    }

    handleOrganizationConfigurationErrors(orgConfigResponse: any, response: ReturnTypeOfSyncOrg): ReturnTypeOfSyncOrg {
        throw new Error("Method not implemented.");
    }

    createMissingTeams(orgName: string, teamsToCreate: string[], shortLink: string): Promise<void> {
        throw new Error("Method not implemented.");
    }

    syncOrganizationMembersByTeam(teamName: string, sourceTeamMap: Map<string, string>): Promise<void> {
        throw new Error("Method not implemented.");
    }

    syncOrganizationMembersGroup(membersGroupName: string, orgConfig: OrgConfig, currentInvites: OrgInvite[]): Promise<GitHubId[]> {
        throw new Error("Method not implemented.");
    }

    syncGitHubTeams(gitHubTeams: string[], currentInvites: OrgInvite[], orgConfig: OrgConfig): Promise<void> {
        throw new Error("Method not implemented.");
    }

    syncOrganizationOwners(ownerGroupName: string, response: ReturnTypeOfSyncOrg): Promise<ReturnTypeOfSyncOrg> {
        throw new Error("Method not implemented.");
    }

    addCopilotSubscriptions(orgConfig: OrgConfig, response: ReturnTypeOfSyncOrg): Promise<ReturnTypeOfSyncOrg> {
        throw new Error("Method not implemented.");
    }
}

type ReturnTypeOfSyncOrg = {
    message?: string;
    status: "failed" | "completed" | "no_config" | "bad_config";
    orgName: string;
    syncedSecurityManagerTeams: string[];
    orgOwnersGroup: string;
    ignoredTeams: string[];
    copilotTeams: CopilotAddResponse[];
}

type FailedSecSync = {
    Success: false,
    Message: string
}

type SuccessSync = {
    Success: true,
    SyncedSecurityManagerTeams: string[]
}

export { IGitHubSyncer, ReturnTypeOfSyncOrg, FailedSecSync, SuccessSync };