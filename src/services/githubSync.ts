// REMEMBER TO REPLACE '_' with '-' for GitHub Names! 🤦‍♂️

import { AppConfig } from "./appConfig";
import { GitHubId, InstalledClient } from "./gitHubTypes";
import { SearchAllAsync } from "./ldapClient";

const teamDescription = "🤖 This Team is controlled by the Groups to Teams Sync bot! Any changes will be overridden. For more information, please check out the following: https://github.com/cloudpups/groups-to-teams-sync-bot";

async function GetGitHubIds(teamName: string, config: AppConfig) {
    const membersFromSourceOfTruth = await SearchAllAsync(teamName);

    return membersFromSourceOfTruth.entries.map(e => {
        return e.cn.replace('_', '-') + config.GitHubIdAppend;
    })
}

async function SynchronizeOrgMembers(installedGitHubClient: InstalledClient, teamName: string, config: AppConfig) {
    const gitHubIds = await GetGitHubIds(teamName, config);

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
        console.log(`The following issues were found when syncing ${orgName}/${teamName}: ${JSON.stringify(problematicGitHubIds)}`)
    }

    return orgMembers;
}

async function SynchronizeGitHubTeam(installedGitHubClient: InstalledClient, teamName: string, config: AppConfig, existingMembers: GitHubId[]) {    
    const trueMembersList = await GetGitHubIds(teamName, config);
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

        const isMember = existingMembers.filter(em => em == gitHubId);

        if (!isMember) {
            return {
                successful: false,
                gitHubId: gitHubId,
                message: `User '${gitHubId} is not an Org Member of ${orgName}`
            };
        }

        return {
            successful: true,
            gitHubId: gitHubId
        };
    }

    const validMemberCheckResults = await Promise.all(trueMembersList.map(tm => checkValidOrgMember(tm)));
    const trueValidTeamMembersList: string[] = validMemberCheckResults.filter(r => r.successful).map(r => r.gitHubId);

    await installedGitHubClient.UpdateTeamDetails(teamName, teamDescription);

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

    console.log(JSON.stringify(teamSyncNotes));

    await Promise.all(membersToRemove.map(mtr => installedGitHubClient.RemoveTeamMemberAsync(teamName, mtr)));
    await Promise.all(membersToAdd.map(mta => installedGitHubClient.AddTeamMember(teamName, mta)));
}

export async function SyncOrg(installedGitHubClient: InstalledClient, config: AppConfig) {
    const orgName = installedGitHubClient.GetCurrentOrgName();
    const orgConfigResponse = await installedGitHubClient.GetConfigurationForInstallation();

    if (!orgConfigResponse.successful) {
        throw new Error("Cannot fetch org config");
    }

    const teamsThatShouldExist = [
        ...config.SecurityManagerTeams,
        ...(orgConfigResponse.data.GitHubTeamNames ?? []),
        ...(orgConfigResponse.data.OrganizationMembersGroup != undefined ? [orgConfigResponse.data.OrganizationMembersGroup] : [])
    ]

    const existingTeamsResponse = await installedGitHubClient.GetAllTeams();

    if(!existingTeamsResponse.successful) {
        throw new Error("Unable to get existing teams");
    }

    const setOfExistingTeams = new Set(existingTeamsResponse.data.map(t => t.Name.toUpperCase()));        
    const teamsToCreate = teamsThatShouldExist.filter(t => !setOfExistingTeams.has(t.toUpperCase()))

    if(teamsToCreate.length > 0) {
        for(let t of teamsToCreate) {
            console.log(`Creating team '${orgName}/${t}'`)
            await installedGitHubClient.CreateTeam(t);
        }
    }

    if (config.SecurityManagerTeams) {
        for (let t of config.SecurityManagerTeams) {
            console.log(`Syncing Security Managers for ${installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            const orgMembers = await SynchronizeOrgMembers(installedGitHubClient, t, config);
            await SynchronizeGitHubTeam(installedGitHubClient, t, config, orgMembers);
        }
    }    
   
    const orgConfig = orgConfigResponse.data;

    console.log(orgConfig);

    let currentMembers: GitHubId[] = [];
    if (orgConfig.OrganizationMembersGroup != undefined || orgConfig.OrganizationMembersGroup != null) {
        console.log(`Syncing Members for ${installedGitHubClient.GetCurrentOrgName()}: ${orgConfig.OrganizationMembersGroup}`)
        currentMembers = await SynchronizeOrgMembers(installedGitHubClient, orgConfig.OrganizationMembersGroup, config)
        await SynchronizeGitHubTeam(installedGitHubClient, orgConfig.OrganizationMembersGroup, config, currentMembers);
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
        return
    }

    async function syncTeam(teamName: string) {
        console.log(`Syncing Team Members for ${teamName} in ${installedGitHubClient.GetCurrentOrgName()}`)
        await SynchronizeGitHubTeam(installedGitHubClient, teamName, config, currentMembers);
    }

    const teamSyncPromises = orgConfig.GitHubTeamNames.map(t => syncTeam(t));

    await Promise.all(teamSyncPromises);
}