// REMEMBER TO REPLACE '_' with '-' for GitHub Names! 🤦‍♂️

import { ILogger, Log, LogError } from "../logging";
import { AppConfig } from "./appConfig";
import { CopilotAddResponse, GitHubId, IInstalledClient, OrgConfigResponse, OrgConfigResponseBad, OrgConfigResponseSuccess, OrgInvite } from "./gitHubTypes";
import { IGitHubInvitations } from "./githubInvitations";
import { ISourceOfTruthClient } from "./teamSourceOfTruthClient";
import { OrgConfig } from "./orgConfig";
import { ICacheClient } from "./CacheClient";

function teamDescription(shortLink: string, sourceTeam: string) {
    return `🤖 Managed by GTTSB: ${shortLink} | Source Team: ${sourceTeam}`
}

const replaceAll = function (original: string, search: string, replacement: string) {
    const target = original;
    return target.replace(new RegExp(search, 'g'), replacement);
};

type GitHubIdsFailed = {
    Succeeded: false
    Reason: "unknown" | "team_not_found"
}

type GitHubIdsSucceeded = {
    Succeeded: true
    Ids: string[]
}

type SyncMembersFailed = {
    Succeeded: false
    Reason: "unknown" | "team_not_found"
}

type SyncMembersSucceeded = {
    Succeeded: true
    OrgMembers: string[]
}

type SyncMembersResponse = Promise<SyncMembersFailed | SyncMembersSucceeded>

export class GitHubSyncer {
    private orgConfigResponse: OrgConfigResponseSuccess | OrgConfigResponseBad | null = null;

    constructor(private installedGitHubClient: IInstalledClient, private appConfig: AppConfig, private invitationsClient: IGitHubInvitations, private sourceOfTruthClient: ISourceOfTruthClient, private logger:ILogger) { }

    public get InstalledGitHubClient() {
        return this.installedGitHubClient;
    }

    public get InvitationsClient() {
        return this.invitationsClient;
    }

    public get AppConfig() {
        return this.appConfig;
    }

    public async Initialize() {
        this.orgConfigResponse = await this.installedGitHubClient.GetConfigurationForInstallation();
        return this.orgConfigResponse;
    }

    // TODO: replace with "sync teams"
    public async CreateTeams(teamsToCreate: string[]) {
        if (teamsToCreate.length > 0) {
            // log("", "CreateTeams", "Started");
            for (const t of teamsToCreate) {
                // Log(`Creating team '${orgName}/${t}'`)
                await this.installedGitHubClient.CreateTeam(t, teamDescription(this.appConfig.Description.ShortLink, t));
            }
            // log("", "CreateTeams", "Completed");
        }
    }

    public async GetGitHubIds(teamName: string): Promise<GitHubIdsFailed | GitHubIdsSucceeded> {
        Log(`Searching for group '${teamName}'`)
        const membersFromSourceOfTruth = await this.sourceOfTruthClient.SearchAllAsync(teamName);

        if (membersFromSourceOfTruth.Succeeded == false) {
            if (membersFromSourceOfTruth.Reason == "team_not_found") {
                return {
                    Succeeded: false,
                    Reason: "team_not_found"
                }
            }

            return {
                Succeeded: false,
                Reason: "unknown"
            }
        }

        Log(`Found the following members '${JSON.stringify(membersFromSourceOfTruth)}'`)

        return {
            Succeeded: true,
            Ids: membersFromSourceOfTruth.entries.map(e => {
                const replace1 = replaceAll(e.cn, '_', '-');
                const replace2 = replace1.replaceAll(".", "-");
                return replace2 + this.appConfig.GitHubIdAppend;
            })
        }
    }

    public async addOrgMember(gitHubId: GitHubId) {
        const isUserReal = await this.installedGitHubClient.DoesUserExist(gitHubId);

        if (!isUserReal.successful || !isUserReal.data) {
            return {
                successful: false,
                user: gitHubId,
                message: `User '${gitHubId}' does not exist in GitHub.`
            }
        }

        const isUserMemberAsync = await this.installedGitHubClient.IsUserMember(gitHubId)

        if (!isUserMemberAsync.successful) {
            throw new Error("What");
        }

        if (isUserMemberAsync.data) {
            return {
                successful: true,
                user: gitHubId
            }
        }

        await this.installedGitHubClient.AddOrgMember(gitHubId)

        return {
            successful: true,
            user: gitHubId
        }
    }

    public async SynchronizeOrgMembers(teamName: string, sourceTeamMap: Map<string, string>): SyncMembersResponse {
        const actualTeamName = sourceTeamMap.get(teamName) ?? teamName;

        const gitHubIdsResponse = await this.GetGitHubIds(actualTeamName);

        if (gitHubIdsResponse.Succeeded == false) {
            if (gitHubIdsResponse.Reason == "team_not_found") {
                return {
                    Succeeded: false,
                    Reason: "team_not_found"
                }
            }

            return {
                Succeeded: false,
                Reason: "unknown"
            };
        }

        const gitHubIds = gitHubIdsResponse.Ids!;

        const orgName = this.installedGitHubClient.GetCurrentOrgName();

        Log("Adding Org Members to " + orgName + " via " + actualTeamName + ": Started");
        const orgMemberPromises = gitHubIds.map(g => this.addOrgMember(g));
        const responses = await Promise.all(orgMemberPromises);
        Log("Adding Org Members to " + orgName + " via " + actualTeamName + ": Completed");

        const orgMembers = responses.filter(r => r.successful).map(r => r.user);
        const problematicGitHubIds = responses.filter(r => !r.successful);

        if (problematicGitHubIds.length > 0) {
            Log(`The following issues were found when syncing ${orgName}/${teamName}: ${JSON.stringify(problematicGitHubIds)}`)
        }

        return {
            Succeeded: true,
            OrgMembers: orgMembers
        };
    }

    public async SynchronizeGitHubTeam(teamName: string, existingInvites: OrgInvite[], sourceTeamMap: Map<string, string>, checkOrgMembers: boolean = true, dryRun: boolean = false) {
        function GetSourceOrReturn(teamName: string) {
            return sourceTeamMap.get(teamName) ?? teamName;
        }

        await this.installedGitHubClient.UpdateTeamDetails(teamName, teamDescription(this.appConfig.Description.ShortLink, GetSourceOrReturn(teamName)));

        const trueMembersListResponse = await this.GetGitHubIds(GetSourceOrReturn(teamName));

        const idsWithInvites = new Set(existingInvites.map(i => i.GitHubUser));

        if (trueMembersListResponse.Succeeded == false) {
            return false;
        }

        const trueMembersList = trueMembersListResponse.Ids;

        if (trueMembersList.length < 1) {
            Log(`Found no members for '${teamName}' in source of truth. Skipping.`)
            return;
        }

        const orgName = this.installedGitHubClient.GetCurrentOrgName();

        const memberCheckFunc = async (id: GitHubId) => {
            const response = await this.installedGitHubClient.IsUserMember(id);

            return response.successful && response.data;
        }

        const validMemberCheckResults = await Promise.all(trueMembersList.map(tm => checkValidOrgMember({
            gitHubId: tm,
            checkOrgMembers: checkOrgMembers,
            isExistingMember: memberCheckFunc,
            idsWithInvites: idsWithInvites,
            installedGitHubClient: this.installedGitHubClient,
            orgName: orgName
        })));

        const trueValidTeamMembersList: string[] = validMemberCheckResults.filter(r => r.successful).map(r => r.gitHubId);

        const listMembersResponse = await this.installedGitHubClient.ListCurrentMembersOfGitHubTeam(teamName);

        if (!listMembersResponse.successful) {
            throw new Error("");
        }

        const currentTeamMembers = listMembersResponse.data;

        const teamMembersToRemove = currentTeamMembers.filter(m => !trueValidTeamMembersList.find((rm => rm == m)));
        const teamMembersToAdd = trueValidTeamMembersList.filter(m => !currentTeamMembers.find((rm) => rm == m));

        const teamSyncNotes = {
            operation: "TeamSync:Prepared",
            teamSlug: `${orgName}/${teamName}`,
            toRemove: teamMembersToRemove,
            toAdd: teamMembersToAdd,
            issues: validMemberCheckResults.filter(r => !r.successful)
        }

        Log(JSON.stringify(teamSyncNotes));

        if (dryRun === true) {
            return teamSyncNotes;
        }

        const deleteResponses = await Promise.all(teamMembersToRemove.map(mtr => this.installedGitHubClient.RemoveTeamMemberAsync(teamName, mtr)));
        const addResponses = await Promise.all(teamMembersToAdd.map(mta => this.installedGitHubClient.AddTeamMember(teamName, mta)));

        const teamSyncCompleteNotes = {
            operation: "TeamSync:Completed",
            teamSlug: `${orgName}/${teamName}`,
            toRemove: teamMembersToRemove,
            toAdd: teamMembersToAdd,
            // TODO: improve clarity of issues        
            issues: [...deleteResponses.filter(t => !t.successful), ...addResponses.filter(t => !t.successful)]
        }

        Log(JSON.stringify(teamSyncCompleteNotes));

        return teamSyncCompleteNotes;
    }

    public async SyncSecurityManagers(): Promise<SuccessSync | FailedSecSync> {    
        this.logger.Log("Syncing Security Managers");    
        const securityManagersFromOrgConfig = this.orgConfigResponse && this.orgConfigResponse.successful ? this.orgConfigResponse.data.AdditionalSecurityManagerGroups : [];
        const securityManagersDisplayNameSourceMap = this.orgConfigResponse && this.orgConfigResponse.successful ? this.orgConfigResponse.data.DisplayNameToSourceMap : new Map<string, string>();

        const securityManagerTeams = [
            ...this.appConfig.SecurityManagerTeams,
            ...securityManagersFromOrgConfig
        ];    

        const successfulTeams:string[] = [];

        const currentInvitesResponse = await this.invitationsClient.ListInvites();
        if (!currentInvitesResponse.successful) {
            return {
                Success: false,
                Message: "Failed to sync security managers- Unable to list invites"
            }
        }

        const currentInvites = currentInvitesResponse.data;
        const existingTeamsResponse = await this.installedGitHubClient.GetAllTeams();
        if (!existingTeamsResponse.successful) {
            return {
                Success: false,
                Message: "Failed to sync security managers- Unable to get existing teams"
            }
        }        
        const setOfExistingTeams = new Set(existingTeamsResponse.data.map(t => t.Name.toUpperCase()));

        if (securityManagerTeams.length > 0) {            
            const syncManagersResponse = await this.syncSecurityManagers({
                currentInvites,
                securityManagerTeams,
                setOfExistingTeams,
                shortLink: this.appConfig.Description.ShortLink,
                displayNameToSourceMap: securityManagersDisplayNameSourceMap
            });

            if (!syncManagersResponse.Success) {
                this.logger.Log("Failed to sync security managers");
                return {
                    Success: false,
                    Message: "Failed to sync security managers"
                }
            }

            this.logger.Log("Successfully synced security managers");

            successfulTeams.push(...syncManagersResponse.SyncedSecurityManagerTeams);               
        }

        return {
            Success: true,
            SyncedSecurityManagerTeams: successfulTeams
        }
    }

    private async syncSecurityManagers(opts: {
        securityManagerTeams: string[]
        setOfExistingTeams: Set<string>
        shortLink: string
        currentInvites: OrgInvite[],
        displayNameToSourceMap: Map<string, string>,
    }): Promise<SuccessSync | FailedSecSync> {
        const { securityManagerTeams, setOfExistingTeams, shortLink, currentInvites, displayNameToSourceMap } = opts;

        const orgName = this.installedGitHubClient.GetCurrentOrgName();

        for (const t of securityManagerTeams) {
            if (!setOfExistingTeams.has(t.toUpperCase())) {
                this.logger.Log(`Creating team '${orgName}/${t}'`)
                await this.installedGitHubClient.CreateTeam(t, teamDescription(shortLink, t));
                setOfExistingTeams.add(t);
            }

            this.logger.Log(`Syncing Security Managers for ${this.installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            const orgMembers = await this.SynchronizeOrgMembers(t, displayNameToSourceMap);

            if (orgMembers.Succeeded == false) {
                return {
                    Success: false,
                    Message: "Failed to sync org members"
                };
            }


            await this.SynchronizeGitHubTeam(t, currentInvites, displayNameToSourceMap);

            this.logger.Log(`Add Security Manager Team for ${this.installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            const addResult = await this.installedGitHubClient.AddSecurityManagerTeam(t);
            if (addResult) {
                this.logger.Log(`Added Security Manager Team for ${this.installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            }
        }

        return {
            Success: true,
            SyncedSecurityManagerTeams: securityManagerTeams
        }
    }

    public async syncOrgMembersByTeam(teamName: string, sourceTeamMap: Map<string, string>) {
        const sourceTeamName = sourceTeamMap.get(teamName) ?? teamName;
        Log(`Adding Org Members via ${sourceTeamName} membership in ${this.installedGitHubClient.GetCurrentOrgName()}`);
        await this.SynchronizeOrgMembers(sourceTeamName, sourceTeamMap);
    }

    async syncTeam(teamName: string, orgConfig: OrgConfig, currentInvites: OrgInvite[]) {
        Log(`Syncing Team Members for ${teamName} in ${this.installedGitHubClient.GetCurrentOrgName()}`)
        await this.SynchronizeGitHubTeam(teamName, currentInvites, orgConfig.DisplayNameToSourceMap);
    }

    public async SyncTeam(teamName: string, invites: OrgInvite[], sourceTeamMap: Map<string, string>, dryRun: boolean = false) {
        const response = await this.SynchronizeGitHubTeam(teamName, invites, sourceTeamMap, true, dryRun);

        return response;
    }
}



export type ReturnTypeOfSyncOrg = {
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

async function checkValidOrgMember(opts: {
    gitHubId: GitHubId,
    installedGitHubClient: IInstalledClient,
    checkOrgMembers: boolean,
    orgName: string,
    idsWithInvites: Set<string>,
    isExistingMember: (id: GitHubId) => Promise<boolean>
}) {
    const { installedGitHubClient, gitHubId, checkOrgMembers, orgName, idsWithInvites, isExistingMember } = opts;

    const isUserReal = await installedGitHubClient.DoesUserExist(gitHubId);

    if (!isUserReal.successful || !isUserReal.data) {
        return {
            successful: false,
            gitHubId: gitHubId,
            message: `User '${gitHubId}' does not exist in GitHub.`
        };
    }

    if (idsWithInvites.has(gitHubId)) {
        return {
            successful: false,
            gitHubId: gitHubId,
            message: `User '${gitHubId} has a Pending Invite to ${orgName}`
        };
    }

    if (checkOrgMembers) {
        const isMember = await isExistingMember(gitHubId);

        if (!isMember) {
            return {
                successful: false,
                gitHubId: gitHubId,
                message: `User '${gitHubId} is not an Org Member of ${orgName}`
            };
        }
    }
    else {
        Log(`Skipping Org Membership check for ${gitHubId}`);
    }

    return {
        successful: true,
        gitHubId: gitHubId
    };
}