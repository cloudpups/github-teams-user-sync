// REMEMBER TO REPLACE '_' with '-' for GitHub Names! 🤦‍♂️

import { Log, LogError } from "../logging";
import { AppConfig } from "./appConfig";
import { CopilotAddResponse, GitHubId, IInstalledClient, OrgInvite } from "./gitHubTypes";
import { IGitHubInvitations } from "./githubInvitations";
import { SearchAllAsync } from "./teamSourceOfTruthClient";
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
    constructor(private installedGitHubClient: IInstalledClient, private config: AppConfig, private invitationsClient: IGitHubInvitations, private cacheClient:ICacheClient) { }

    async GetGitHubIds(teamName: string): Promise<GitHubIdsFailed | GitHubIdsSucceeded> {
        Log(`Searching for group '${teamName}'`)
        const membersFromSourceOfTruth = await SearchAllAsync(teamName, this.cacheClient);
    
        if (membersFromSourceOfTruth.Succeeded == false) {
            if(membersFromSourceOfTruth.Reason == "team_not_found") {
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
                return replace2 + this.config.GitHubIdAppend;
            })
        }
    }

    async addOrgMember(gitHubId: GitHubId) {
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

    async SynchronizeOrgMembers(teamName: string, sourceTeamMap: Map<string, string>): SyncMembersResponse {
        const actualTeamName = sourceTeamMap.get(teamName) ?? teamName;
            
        const gitHubIdsResponse = await this.GetGitHubIds(actualTeamName);
    
        if (gitHubIdsResponse.Succeeded == false) {
            if(gitHubIdsResponse.Reason == "team_not_found") {
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
    
    async SynchronizeGitHubTeam(teamName: string, existingInvites: OrgInvite[], sourceTeamMap: Map<string, string>, checkOrgMembers: boolean = true, dryRun: boolean = false) {
        function GetSourceOrReturn(teamName: string) {
            return sourceTeamMap.get(teamName) ?? teamName;
        }
    
        await this.installedGitHubClient.UpdateTeamDetails(teamName, teamDescription(this.config.Description.ShortLink, GetSourceOrReturn(teamName)));
    
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
    
        const memberCheckFunc = async (id:GitHubId) => {
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
    
        if(dryRun === true) {
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

    async SyncSecurityManagers(opts: {
        securityManagerTeams: string[]
        setOfExistingTeams: Set<string>
        shortLink: string                
        currentInvites: OrgInvite[],
        displayNameToSourceMap: Map<string,string>,        
    }): Promise<SuccessSync | FailedSecSync> {
        const { securityManagerTeams, setOfExistingTeams, shortLink, currentInvites, displayNameToSourceMap } = opts;
    
        const orgName = this.installedGitHubClient.GetCurrentOrgName();
    
        for (const t of securityManagerTeams) {        
            if (!setOfExistingTeams.has(t.toUpperCase())) {
                Log(`Creating team '${orgName}/${t}'`)
                await this.installedGitHubClient.CreateTeam(t, teamDescription(shortLink, t));
                setOfExistingTeams.add(t);
            }
    
            Log(`Syncing Security Managers for ${this.installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            const orgMembers = await this.SynchronizeOrgMembers(t, displayNameToSourceMap);
    
            if (orgMembers.Succeeded == false) {
                return {
                    Success: false,
                    Message: "Failed to sync org members"
                };
            }
    
    
            await this.SynchronizeGitHubTeam(t, currentInvites, displayNameToSourceMap);
    
            Log(`Add Security Manager Team for ${this.installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            const addResult = await this.installedGitHubClient.AddSecurityManagerTeam(t);
            if (addResult) {
                Log(`Added Security Manager Team for ${this.installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            }
        }
    
        return {
            Success: true,
            SyncedSecurityManagerTeams: securityManagerTeams
        }
    }
    
    async syncOrgMembersByTeam(teamName: string, sourceTeamMap: Map<string, string>) {
        const sourceTeamName = sourceTeamMap.get(teamName) ?? teamName;
        Log(`Adding Org Members via ${sourceTeamName} membership in ${this.installedGitHubClient.GetCurrentOrgName()}`);
        await this.SynchronizeOrgMembers(sourceTeamName, sourceTeamMap);
    }

    async syncTeam(teamName: string, orgConfig: OrgConfig, currentInvites: OrgInvite[]) {
        Log(`Syncing Team Members for ${teamName} in ${this.installedGitHubClient.GetCurrentOrgName()}`)
        await this.SynchronizeGitHubTeam(teamName, currentInvites, orgConfig.DisplayNameToSourceMap);
    }

    async syncOrg(log:(message: string, operation:string, status:string)=>void): Promise<ReturnTypeOfSyncOrg> {
        const orgName = this.installedGitHubClient.GetCurrentOrgName();
    
        let response: ReturnTypeOfSyncOrg = {
            orgName: orgName,
            status: "failed",
            syncedSecurityManagerTeams: [] as string[],
            orgOwnersGroup: "",
            ignoredTeams: [] as string[],
            copilotTeams: [] as CopilotAddResponse[]
        }
    
        // TODO: add this back once these APIs make sense
        // and function...
        // await CancelPendingOrgInvites(installedGitHubClient);
    
        const currentInvitesResponse = await this.invitationsClient.ListInvites();
    
        if (!currentInvitesResponse.successful) {
            throw new Error("Unable to list invites");
        }
    
        const currentInvites = currentInvitesResponse.data;
    
        const existingTeamsResponse = await this.installedGitHubClient.GetAllTeams();
        if (!existingTeamsResponse.successful) {
            throw new Error("Unable to get existing teams");
        }
        log("", "TeamNames", JSON.stringify(existingTeamsResponse));
        const setOfExistingTeams = new Set(existingTeamsResponse.data.map(t => t.Name.toUpperCase()));
    
        log("", "GetConfiguration", "Started");
        const orgConfigResponse = await this.installedGitHubClient.GetConfigurationForInstallation();    
    
        const securityManagersFromOrgConfig = orgConfigResponse.successful ? orgConfigResponse.data.AdditionalSecurityManagerGroups : [];
        const securityManagersDisplayNameSourceMap = orgConfigResponse.successful ? orgConfigResponse.data.DisplayNameToSourceMap : new Map<string,string>();
    
        const securityManagerTeams = [
            ...this.config.SecurityManagerTeams,
            ...securityManagersFromOrgConfig
        ];        
        log("", "GetConfiguration", "Completed");
        
        if (securityManagerTeams.length > 0) {
            log("", "SyncSecurityManagers", "Started");
            const syncManagersResponse = await this.SyncSecurityManagers({                                
                currentInvites,
                securityManagerTeams,            
                setOfExistingTeams,            
                shortLink: this.config.Description.ShortLink,
                displayNameToSourceMap: securityManagersDisplayNameSourceMap                
            });
    
            if (!syncManagersResponse.Success) {
                return {
                    ...response,
                    message: "Cannot sync security managers",
                    status: "failed"
                }
            }
    
            response = {
                ...response,
                syncedSecurityManagerTeams: syncManagersResponse.SyncedSecurityManagerTeams
            }
            log("", "SyncSecurityManagers", "Completed");
        }        
    
        if (!orgConfigResponse.successful && orgConfigResponse.state == "NoConfig") {
            return {
                ...response,
                message: "Cannot access/fetch organization config",
                status: "no_config"
            }
        }
        else if(!orgConfigResponse.successful && orgConfigResponse.state == "BadConfig") {
            return {
                ...response,
                message: orgConfigResponse.message,
                status: "bad_config"
            }
        } 
        else if (!orgConfigResponse.successful) {
            return {
                ...response,
                message: orgConfigResponse.message,
                status: "bad_config"
            }
        }
    
        const orgConfig = orgConfigResponse.data;
    
        Log(JSON.stringify(orgConfig));
    
        const ownerGroupName = orgConfig.OrgOwnersGroupName;
        const membersGroupName = orgConfig.OrgMembersGroupName;
        const { teamsToManage: gitHubTeams, ignoredTeams } = RemoveTeamsToIgnore(orgConfig.TeamsToManage, this.config);
    
        response.ignoredTeams = ignoredTeams;
    
        const teamsThatShouldExist: string[] = [
            ...securityManagerTeams,
            ...gitHubTeams,
            ...(ownerGroupName != undefined ? [ownerGroupName] : []),
            ...(membersGroupName != undefined ? [membersGroupName] : [])
        ]
    
        const teamsToCreate = teamsThatShouldExist.filter(t => !setOfExistingTeams.has(t.toUpperCase()))
    
        if (teamsToCreate.length > 0) {
            log("", "CreateTeams", "Started");
            for (const t of teamsToCreate) {
                Log(`Creating team '${orgName}/${t}'`)
                await this.installedGitHubClient.CreateTeam(t, teamDescription(this.config.Description.ShortLink, t));
            }
            log("", "CreateTeams", "Completed");
        }            
    
        if (orgConfig.AssumeMembershipViaTeams) {
            // TODO: this method is getting very busy, and most likely could benefit from a larger refactor.
            // Benefits most likely include performance gains.
            Log(`Syncing Members for ${this.installedGitHubClient.GetCurrentOrgName()} by individual teams.`);
            log("", "MembershipSync_ByTeam", "Started");
            const orgMembershipPromises = gitHubTeams.map(t => this.syncOrgMembersByTeam(t, orgConfig.DisplayNameToSourceMap));
            await Promise.all(orgMembershipPromises);
            log("", "MembershipSync_ByTeam", "Completed");
        }
    
        let currentMembers: GitHubId[] = [];    
        // TODO: add log message to explain group being skipped if it is included in TeamsToIgnore
        if (membersGroupName != undefined && membersGroupName != null && !this.config.TeamsToIgnore.includes(membersGroupName)) {
            Log(`Syncing Members for ${this.installedGitHubClient.GetCurrentOrgName()}: ${membersGroupName}`)
            log("", "MembershipSync_ByOrgMembersGroup", "Started");
            const currentMembersResponse = await this.SynchronizeOrgMembers(membersGroupName,orgConfig.DisplayNameToSourceMap)
    
            if (currentMembersResponse.Succeeded == false) {
                Log("Failed to sync members");
    
                if(currentMembersResponse.Reason == "team_not_found") {
                    return {
                        ...response,
                        message: "Org Membership Group does not appear to exist in source of truth.",
                        status: "bad_config"
                    };
                }            
    
                return {
                    ...response,
                    message: "Failed to sync org members"
                };
            }
    
            currentMembers = currentMembersResponse.OrgMembers;
    
            await this.SynchronizeGitHubTeam(membersGroupName, currentInvites, orgConfig.DisplayNameToSourceMap);
            log("", "MembershipSync_ByOrgMembersGroup", "Completed");
        }
    
        if (!gitHubTeams || gitHubTeams.length < 1) {
            // no teams to sync
            return response;
        }            
    
        const teamSyncPromises = gitHubTeams.map(t => this.syncTeam(t, orgConfig, currentInvites));
    
        log("", "TeamSync", "Started");
        await Promise.all(teamSyncPromises);
        log("", "TeamSync", "Completed");
    
        if (ownerGroupName) {
            log("", "OrgOwnerSync", "Started");
            const teamMembers = await this.installedGitHubClient.ListCurrentMembersOfGitHubTeam(ownerGroupName);
    
            if (!teamMembers.successful) {
                return {
                    ...response,
                    status: "failed"
                }
            }
    
            for (const id of teamMembers.data) {
                Log(JSON.stringify({
                    message: `Adding Org Owner`,
                    org: this.installedGitHubClient.GetCurrentOrgName(),
                    gitHubUser: id
                }))
                await this.installedGitHubClient.SetOrgRole(id, "admin");
    
                response = {
                    ...response,
                    orgOwnersGroup: ownerGroupName
                }
            }
            log("", "OrgOwnerSync", "Completed");
        }
    
        log("", "AddCopilotSubscriptions", "Started");
        const copilotResult = await this.installedGitHubClient.AddTeamsToCopilotSubscription(orgConfig.CopilotTeams);
        log("", "AddCopilotSubscriptions", "Completed");
    
        return {
            ...response,
            status: "completed",
            copilotTeams: copilotResult.successful ? copilotResult.data : []
        }
    }
    
    
    public async SyncTeam(teamName: string, invites: OrgInvite[], sourceTeamMap: Map<string, string>, dryRun: boolean = false) {
        const response = await this.SynchronizeGitHubTeam(teamName, invites, sourceTeamMap, true, dryRun);
    
        return response;
    }
    
    public async SyncOrg(): Promise<ReturnTypeOfSyncOrg> {
        const orgName = this.installedGitHubClient.GetCurrentOrgName();
    
        // For more context since this repo doesn't fully 
        // follow OpenTelemetry, yet: https://opentelemetry.io/docs/concepts/signals/traces/
        const traceKey = crypto.randomUUID();
    
        Log(JSON.stringify(
            {
                orgName: orgName,
                operation: "OrgSync",
                status: "Started",
                trace_id: traceKey
            }
        ));
    
        try {
            const log = (message: string, operation:string, status:string) => {
                Log(JSON.stringify(
                    {
                        data: message,
                        orgName: orgName,
                        operation: operation,
                        status: status,
                        trace_id: traceKey
                    }
                ));            
            };
    
            const response = await this.syncOrg(log);
    
            Log(JSON.stringify(
                {
                    data: response,
                    orgName: orgName,
                    operation: "OrgSync",
                    status: "completed",
                    trace_id: traceKey
                }
            ));
    
            return response;
        }
        catch (error) {
            LogError(JSON.stringify({
                error: error as any,
                orgName: orgName,
                trace_id: traceKey    
            }));
    
            const response: ReturnTypeOfSyncOrg = {
                orgName: orgName,
                message: `Failed to sync org. Please check logs for Trace ID == ${traceKey}`,
                status: "failed",
                syncedSecurityManagerTeams: [],
                orgOwnersGroup: "",
                ignoredTeams: [],
                copilotTeams: []
            }
    
            Log(JSON.stringify(
                {
                    data: response,
                    orgName: orgName,
                    operation: "OrgSync",
                    status: "failed",
                    trace_id: traceKey
                }
            ));
    
            return response;
        }
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

function RemoveTeamsToIgnore(TeamsToManage: string[], appConfig: AppConfig) {
    const teamsToIgnore = new Set(appConfig.TeamsToIgnore.map(tti => tti.toLowerCase()) ?? []);

    return {
        teamsToManage: TeamsToManage.filter(t => !teamsToIgnore.has(t.toLowerCase())),
        ignoredTeams: TeamsToManage.filter(t => teamsToIgnore.has(t.toLowerCase()))
    };
}

async function checkValidOrgMember(opts: {
    gitHubId: GitHubId,
    installedGitHubClient: IInstalledClient,
    checkOrgMembers: boolean,
    orgName: string,
    idsWithInvites: Set<string>,
    isExistingMember: (id:GitHubId) => Promise<boolean>
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