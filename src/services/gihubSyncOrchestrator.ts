import { Log, LogError } from "../logging";
import { AppConfig } from "./appConfig";
import { IGitHubInvitations } from "./githubInvitations";
import { GitHubSyncer, ReturnTypeOfSyncOrg } from "./githubSync";
import { CopilotAddResponse, GitHubId, IInstalledClient } from "./gitHubTypes";

export class GihubSyncOrchestrator {
    private appConfig: AppConfig;

    constructor(private gitHubSyncer: GitHubSyncer) {
        this.appConfig = gitHubSyncer.AppConfig;
    }

    async syncOrg(log: (message: string, operation: string, status: string) => void): Promise<ReturnTypeOfSyncOrg> {
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

        log("", "Initialize", "Started");
        const orgConfigResponse = await this.gitHubSyncer.Initialize();        
        
        log("", "Sync Security Managers", "Started");
        const syncSecurityManagersResponse = await this.gitHubSyncer.SyncSecurityManagers();
        if (!syncSecurityManagersResponse.Success) {
            return {
                ...response,
                message: "Unable to sync security managers",
                status: "failed"
            }
        }

        if (!orgConfigResponse.successful && orgConfigResponse.state == "NoConfig") {
            return {
                ...response,
                message: "Cannot access/fetch organization config",
                status: "no_config"
            }
        }
        else if (!orgConfigResponse.successful && orgConfigResponse.state == "BadConfig") {
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
        const { teamsToManage: gitHubTeams, ignoredTeams } = RemoveTeamsToIgnore(orgConfig.TeamsToManage, this.appConfig);

        response.ignoredTeams = ignoredTeams;

        const teamsThatShouldExist: string[] = [
            ...syncSecurityManagersResponse.SyncedSecurityManagerTeams,
            ...gitHubTeams,
            ...(ownerGroupName != undefined ? [ownerGroupName] : []),
            ...(membersGroupName != undefined ? [membersGroupName] : [])
        ]

        const teamsToCreate = teamsThatShouldExist.filter(t => !setOfExistingTeams.has(t.toUpperCase()))

        await this.gitHubSyncer.CreateTeams(teamsToCreate);

        if (orgConfig.AssumeMembershipViaTeams) {
            // TODO: this method is getting very busy, and most likely could benefit from a larger refactor.
            // Benefits most likely include performance gains.
            Log(`Syncing Members for ${this.installedGitHubClient.GetCurrentOrgName()} by individual teams.`);
            log("", "MembershipSync_ByTeam", "Started");
            const orgMembershipPromises = gitHubTeams.map(t => this.gitHubSyncer.syncOrgMembersByTeam(t, orgConfig.DisplayNameToSourceMap));
            await Promise.all(orgMembershipPromises);
            log("", "MembershipSync_ByTeam", "Completed");
        }

        let currentMembers: GitHubId[] = [];
        // TODO: add log message to explain group being skipped if it is included in TeamsToIgnore
        if (membersGroupName != undefined && membersGroupName != null && !this.appConfig.TeamsToIgnore.includes(membersGroupName)) {
            Log(`Syncing Members for ${this.installedGitHubClient.GetCurrentOrgName()}: ${membersGroupName}`)
            log("", "MembershipSync_ByOrgMembersGroup", "Started");
            const currentMembersResponse = await this.gitHubSyncer.SynchronizeOrgMembers(membersGroupName, orgConfig.DisplayNameToSourceMap)

            if (currentMembersResponse.Succeeded == false) {
                Log("Failed to sync members");

                if (currentMembersResponse.Reason == "team_not_found") {
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

            await this.gitHubSyncer.SynchronizeGitHubTeam(membersGroupName, currentInvites, orgConfig.DisplayNameToSourceMap);
            log("", "MembershipSync_ByOrgMembersGroup", "Completed");
        }

        if (!gitHubTeams || gitHubTeams.length < 1) {
            // no teams to sync
            return response;
        }

        const teamSyncPromises = gitHubTeams.map(t => this.gitHubSyncer.SyncTeam(t, currentInvites, orgConfig.DisplayNameToSourceMap));

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
            const log = (message: string, operation: string, status: string) => {
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

function RemoveTeamsToIgnore(TeamsToManage: string[], appConfig: AppConfig) {
    const teamsToIgnore = new Set(appConfig.TeamsToIgnore.map(tti => tti.toLowerCase()) ?? []);

    return {
        teamsToManage: TeamsToManage.filter(t => !teamsToIgnore.has(t.toLowerCase())),
        ignoredTeams: TeamsToManage.filter(t => teamsToIgnore.has(t.toLowerCase()))
    };
}