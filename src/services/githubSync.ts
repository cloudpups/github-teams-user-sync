// REMEMBER TO REPLACE '_' with '-' for GitHub Names! 🤦‍♂️

import { Log, LogError } from "../logging";
import { AppConfig } from "./appConfig";
import { GitHubId, InstalledClient, OrgInvite } from "./gitHubTypes";
import { IGitHubInvitations } from "./githubInvitations";
import { SearchAllAsync } from "./ldapClient";

const teamDescription = "🤖 This Team is controlled by the Groups to Teams Sync bot! Any changes will be overridden. For more information, please check out the following: https://github.com/cloudpups/groups-to-teams-sync-bot";

const replaceAll = function (original: string, search: string, replacement: string) {
    const target = original;
    return target.replace(new RegExp(search, 'g'), replacement);
};

type GitHubIdsFailed = {
    Succeeded: false
}

type GitHubIdsSucceeded = {
    Succeeded: true
    Ids: string[]
}

async function GetGitHubIds(teamName: string, config: AppConfig): Promise<GitHubIdsFailed | GitHubIdsSucceeded> {
    Log(`Searching for group '${teamName}'`)
    const membersFromSourceOfTruth = await SearchAllAsync(teamName);

    if(membersFromSourceOfTruth.Succeeded == false) {
        return {
            Succeeded: false
        }
    }

    Log(`Found the following members '${JSON.stringify(membersFromSourceOfTruth)}'`)

    return {
        Succeeded: true,
        Ids: membersFromSourceOfTruth.entries.map(e => {
            return replaceAll(e.cn, '_', '-') + config.GitHubIdAppend;
        })
    }
}

type SyncFailed = {
    Succeeded: false
}

type SyncSucceeded = {
    Succeeded: true
    OrgMembers: string[]
}

async function SynchronizeOrgMembers(installedGitHubClient: InstalledClient, teamName: string, config: AppConfig): Promise<SyncFailed | SyncSucceeded>{
    const gitHubIdsResponse = await GetGitHubIds(teamName, config);

    if(gitHubIdsResponse.Succeeded == false) {
        return {
            Succeeded:false
        };
    }

    const gitHubIds = gitHubIdsResponse.Ids!;

    const orgName = installedGitHubClient.GetCurrentOrgName();

    async function addOrgMember(gitHubId: GitHubId) {
        const isUserReal = await installedGitHubClient.DoesUserExist(gitHubId);

        if (!isUserReal.successful || !isUserReal.data) {
            return {
                successful: false,
                user: gitHubId,
                message: `User '${gitHubId}' does not exist in GitHub.`
            }
        }

        const isUserMemberAsync = await installedGitHubClient.IsUserMember(gitHubId)

        if (!isUserMemberAsync.successful) {
            throw new Error("What");
        }

        if (isUserMemberAsync.data) {
            return {
                successful: true,
                user: gitHubId
            }
        }

        await installedGitHubClient.AddOrgMember(gitHubId)

        return {
            successful: true,
            user: gitHubId
        }
    }

    const orgMemberPromises = gitHubIds.map(g => addOrgMember(g));

    const responses = await Promise.all(orgMemberPromises);

    const orgMembers = responses.filter(r => r.successful).map(r => r.user);
    const problematicGitHubIds = responses.filter(r => !r.successful);

    if (problematicGitHubIds.length > 0) {
        Log(`The following issues were found when syncing ${orgName}/${teamName}: ${JSON.stringify(problematicGitHubIds)}`)
    }

    return {
        Succeeded:true,
        OrgMembers: orgMembers
    };
}

async function SynchronizeGitHubTeam(installedGitHubClient: InstalledClient, teamName: string, config: AppConfig, existingMembers: GitHubId[], existingInvites:OrgInvite[], checkOrgMembers:boolean = true) {
    await installedGitHubClient.UpdateTeamDetails(teamName, teamDescription);

    const trueMembersListResponse = await GetGitHubIds(teamName, config);

    const idsWithInvites = new Set(existingInvites.map(i => i.GitHubUser));

    if(trueMembersListResponse.Succeeded == false) {
        return false;
    }

    const trueMembersList = trueMembersListResponse.Ids;

    if(trueMembersList.length < 1) {
        Log(`Found no members for '${teamName}' in source of truth. Skipping.`)
        return;
    }

    const orgName = installedGitHubClient.GetCurrentOrgName();

    async function checkValidOrgMember(gitHubId: GitHubId) {
        const isUserReal = await installedGitHubClient.DoesUserExist(gitHubId);

        if (!isUserReal.successful || !isUserReal.data) {
            return {
                successful: false,
                gitHubId: gitHubId,
                message: `User '${gitHubId}' does not exist in GitHub.`
            };
        }

        if(idsWithInvites.has(gitHubId)) {
            return {
                successful: false,
                gitHubId: gitHubId,
                message: `User '${gitHubId} has a Pending Invite to ${orgName}`
            };
        }

        if(checkOrgMembers) {
            const isMember = existingMembers.filter(em => em == gitHubId);

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

    const validMemberCheckResults = await Promise.all(trueMembersList.map(tm => checkValidOrgMember(tm)));
    const trueValidTeamMembersList: string[] = validMemberCheckResults.filter(r => r.successful).map(r => r.gitHubId);

    const listMembersResponse = await installedGitHubClient.ListCurrentMembersOfGitHubTeam(teamName);

    if (!listMembersResponse.successful) {
        throw new Error("");
    }

    const currentTeamMembers = listMembersResponse.data;

    const membersToRemove = currentTeamMembers.filter(m => !trueValidTeamMembersList.find((rm => rm == m)));
    const membersToAdd = trueValidTeamMembersList.filter(m => !currentTeamMembers.find((rm) => rm == m));

    const teamSyncNotes = {
        teamSlug: `${orgName}/${teamName}`,
        toRemove: membersToRemove,
        toAdd: membersToAdd,
        issues: validMemberCheckResults.filter(r => !r.successful)
    }

    Log(JSON.stringify(teamSyncNotes));

    await Promise.all(membersToRemove.map(mtr => installedGitHubClient.RemoveTeamMemberAsync(teamName, mtr)));
    await Promise.all(membersToAdd.map(mta => installedGitHubClient.AddTeamMember(teamName, mta)));

    return teamSyncNotes;
}

type ReturnTypeOfSyncOrg = ReturnType<typeof syncOrg>

async function syncOrg(installedGitHubClient: InstalledClient, config: AppConfig, invitationsClient: IGitHubInvitations) {
    const orgName = installedGitHubClient.GetCurrentOrgName();

    let response = {
        orgName: orgName,
        successful: false,
        syncedSecurityManagerTeams: [] as string[],
        orgOwnersGroup: ""
    }

    // TODO: add this back once these APIs make sense
    // and function...
    // await CancelPendingOrgInvites(installedGitHubClient);

    const currentInvitesResponse = await invitationsClient.ListInvites();

    if(!currentInvitesResponse.successful) {
        return response;
    }

    const currentInvites = currentInvitesResponse.data;

    const existingTeamsResponse = await installedGitHubClient.GetAllTeams();
    if (!existingTeamsResponse.successful) {
        throw new Error("Unable to get existing teams");
    }
    const setOfExistingTeams = new Set(existingTeamsResponse.data.map(t => t.Name.toUpperCase()));

    if (config.SecurityManagerTeams) {
        for (let t of config.SecurityManagerTeams) {
            if (!setOfExistingTeams.has(t.toUpperCase())) {
                Log(`Creating team '${orgName}/${t}'`)
                await installedGitHubClient.CreateTeam(t, teamDescription);
                setOfExistingTeams.add(t);
            }

            Log(`Syncing Security Managers for ${installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            const orgMembers = await SynchronizeOrgMembers(installedGitHubClient, t, config);

            if(orgMembers.Succeeded == false) {
                return false;
            }

            await SynchronizeGitHubTeam(installedGitHubClient, t, config, orgMembers.OrgMembers, currentInvites);

            Log(`Add Security Manager Team for ${installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            const addResult = await installedGitHubClient.AddSecurityManagerTeam(t);
            if(addResult) {
                Log(`Added Security Manager Team for ${installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            }
        }

        response = {
            ...response,
            syncedSecurityManagerTeams: config.SecurityManagerTeams
        }
    }

    const orgConfigResponse = await installedGitHubClient.GetConfigurationForInstallation();

    if (!orgConfigResponse.successful) {
        return {
            ...response,
            message: "Cannot access/fetch organization config"
        }
    }

    const teamsThatShouldExist = [
        ...config.SecurityManagerTeams,
        ...(orgConfigResponse.data.OrganizationOwnersGroup ? [orgConfigResponse.data.OrganizationOwnersGroup] : []),     
        ...(orgConfigResponse.data.GitHubTeamNames ?? []),
        ...(orgConfigResponse.data.OrganizationMembersGroup != undefined ? [orgConfigResponse.data.OrganizationMembersGroup] : [])
    ]

    const teamsToCreate = teamsThatShouldExist.filter(t => !setOfExistingTeams.has(t.toUpperCase()))

    if (teamsToCreate.length > 0) {
        for (const t of teamsToCreate) {
            Log(`Creating team '${orgName}/${t}'`)
            await installedGitHubClient.CreateTeam(t, teamDescription);
        }
    }

    const orgConfig = orgConfigResponse.data;

    Log(JSON.stringify(orgConfig));

    let currentMembers: GitHubId[] = [];
    if (orgConfig.OrganizationMembersGroup != undefined || orgConfig.OrganizationMembersGroup != null) {
        Log(`Syncing Members for ${installedGitHubClient.GetCurrentOrgName()}: ${orgConfig.OrganizationMembersGroup}`)
        const currentMembersResponse = await SynchronizeOrgMembers(installedGitHubClient, orgConfig.OrganizationMembersGroup, config)

        if(currentMembersResponse.Succeeded == false) {
            Log("Failed to sync members");

            return false;
        }

        currentMembers = currentMembersResponse.OrgMembers;

        await SynchronizeGitHubTeam(installedGitHubClient, orgConfig.OrganizationMembersGroup, config, currentMembers, currentInvites);
    }

    if (currentMembers.length == 0) {
        const getOrgMembersResponse = await installedGitHubClient.GetOrgMembers();

        if (!getOrgMembersResponse.successful) {
            throw Error("Unable to get current org members");
        }

        currentMembers = getOrgMembersResponse.data;
    }

    if (!orgConfig.GitHubTeamNames || orgConfig.GitHubTeamNames.length < 1) {
        // no teams to sync
        return response;
    }

    async function syncTeam(teamName: string) {
        Log(`Syncing Team Members for ${teamName} in ${installedGitHubClient.GetCurrentOrgName()}`)
        await SynchronizeGitHubTeam(installedGitHubClient, teamName, config, currentMembers, currentInvites);
    }

    const teamSyncPromises = orgConfig.GitHubTeamNames.map(t => syncTeam(t));

    await Promise.all(teamSyncPromises);
    
    if(orgConfig.OrganizationOwnersGroup) {
        const teamMembers = await installedGitHubClient.ListCurrentMembersOfGitHubTeam(orgConfig.OrganizationOwnersGroup);

        if(!teamMembers.successful) {
            return {
                ...response,
                successful: false                
            } 
        }

        for(const id of teamMembers.data) {
            Log(JSON.stringify({
                message: `Adding Org Owner`,
                org: installedGitHubClient.GetCurrentOrgName(),
                gitHubUser: id
            }))            
            await installedGitHubClient.SetOrgRole(id, "admin");

            response = {
                ...response,
                orgOwnersGroup:  orgConfig.OrganizationOwnersGroup
            }
        }
    }

    return {
        ...response,
        successful: true
    }
}

export async function SyncTeam(teamName:string, client: InstalledClient, config: AppConfig, existingMembers: GitHubId[],invites:OrgInvite[]) {
    const response = await SynchronizeGitHubTeam(client, teamName, config, existingMembers, invites, true);

    return response;
}

export async function SyncOrg(installedGitHubClient: InstalledClient, config: AppConfig, invitationsClient: IGitHubInvitations) : ReturnTypeOfSyncOrg {          
    const orgName = installedGitHubClient.GetCurrentOrgName();
    Log(JSON.stringify(
        {            
            orgName: orgName,
            operation: "OrgSync",
            status: "Started"
        }
    ));
    
    try {
        const response = await syncOrg(installedGitHubClient, config, invitationsClient);

        Log(JSON.stringify(
            {                
                data: response,
                orgName: orgName,
                operation: "OrgSync",
                status: "Completed"
            }
        ));        

        return response;
    }
    catch(error) {
        LogError(error as any);

        const response = {
            orgName: orgName,
            message: "Failed to sync org. Please check logs.",
            successful: false,
            syncedSecurityManagerTeams: [],
            orgOwnersGroup: ""
        }

        Log(JSON.stringify(
            {                
                data: response,
                orgName: orgName,
                operation: "OrgSync",
                status: "Failed"
            }
        )); 

        return response;
    }
}

async function CancelPendingOrgInvites(installedGitHubClient: InstalledClient) {
    const orgName = installedGitHubClient.GetCurrentOrgName();    
    const response = await installedGitHubClient.GetPendingOrgInvites();

    if(!response.successful) {
        return;
    }

    for(const invite of response.data) {
        const user = invite.GitHubUser;
        Log(JSON.stringify({
            message: `Cancelling invite for ${user} in ${orgName}`,
            org: orgName,            
            user: invite.GitHubUser
        }))
        await installedGitHubClient.CancelOrgInvite(invite);
    }
}
