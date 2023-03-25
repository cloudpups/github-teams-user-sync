// REMEMBER TO REPLACE '_' with '-' for GitHub Names! 🤦‍♂️

import { AppConfig } from "./appConfig";
import { InstalledClient } from "./gitHubTypes";
import { SearchAllAsync } from "./ldapClient";

const teamDescription = "🤖 This Team is controlled by the Groups to Teams Sync bot! Any changes will be overridden. For more information, please check out the following: https://github.com/cloudpups/groups-to-teams-sync-bot";

async function GetGitHubIds(teamName:string, config:AppConfig) {
    const membersFromSourceOfTruth = await SearchAllAsync(teamName);    

    return membersFromSourceOfTruth.entries.map(e => {
        return e.cn.replace('_', '-') + config.GitHubIdAppend;
    })
}

async function SynchronizeOrgMembers(installedGitHubClient:InstalledClient, teamName:string, config:AppConfig) {    
    const gitHubIds = await GetGitHubIds(teamName, config);

    for(let gitHubId of gitHubIds) {        
        const isUserMemberAsync = await installedGitHubClient.IsUserMember(gitHubId)

        if(!isUserMemberAsync.successful) {
            throw new Error("What");
        }

        // console.log(`${gitHubId} ${isUserMemberAsync.data ? "is a member" : "is not a member"}`);

        if(isUserMemberAsync.data) {
            continue;
        }

        await installedGitHubClient.AddOrgMember(gitHubId)        
    }
}

async function SynchronizeGitHubTeam(installedGitHubClient:InstalledClient, teamName:string, config:AppConfig) {
    const trueMembersList = await GetGitHubIds(teamName, config);

    const currentOrgMembers: string[] = [];

    for(let m of trueMembersList) {
        const isMember = await installedGitHubClient.IsUserMember(m);

        if(!isMember.successful) {
            throw new Error("User not found");
        }

        if(!isMember.data) {
            continue;
        }

        currentOrgMembers.push(m);
    }

    await installedGitHubClient.UpdateTeamDetails(teamName, teamDescription);

    const listMembersResponse = await installedGitHubClient.ListCurrentMembersOfGitHubTeam(teamName);

    if(!listMembersResponse.successful) {
        throw new Error("");
    }

    const currentMembers = listMembersResponse.data;

    const membersToRemove = currentMembers.filter(m => !currentOrgMembers.find((rm => rm == m)));
    const membersToAdd = currentOrgMembers.filter(m => !currentMembers.find((rm) => rm == m));

    console.log(`To remove: ${JSON.stringify(membersToRemove)}`);
    console.log(`To add: ${JSON.stringify(membersToAdd)}`);

    for(let m of membersToRemove) {
        await installedGitHubClient.RemoveTeamMemberAsync(teamName, m)
    }

    for(let m of membersToAdd) {
        await installedGitHubClient.AddTeamMember(teamName, m)
    }
}

export async function SyncOrg(installedGitHubClient:InstalledClient, config:AppConfig) {
    if(config.SecurityManagerTeams) {
        for(let t of config.SecurityManagerTeams) {
            console.log(`Syncing Security Managers for ${installedGitHubClient.GetCurrentOrgName()}: ${t}`)
            await SynchronizeOrgMembers(installedGitHubClient, t, config);
            await SynchronizeGitHubTeam(installedGitHubClient, t, config);
        }
    }

    const orgConfigResponse = await installedGitHubClient.GetConfigurationForInstallation();

    if(!orgConfigResponse.successful) {
        throw new Error("Cannot fetch org config");
    }

    const orgConfig = orgConfigResponse.data;

    console.log(orgConfig);

    if(orgConfig.OrganizationMembersGroup != undefined || orgConfig.OrganizationMembersGroup != null) {
        console.log(`Syncing Members for ${installedGitHubClient.GetCurrentOrgName()}: ${orgConfig.OrganizationMembersGroup}`)
        await SynchronizeOrgMembers(installedGitHubClient, orgConfig.OrganizationMembersGroup, config)
    }

    if(!orgConfig.GitHubTeamNames || orgConfig.GitHubTeamNames.length < 1) {
        // no teams to sync
        return
    }

    for(let t of orgConfig.GitHubTeamNames) {
        console.log(`Syncing Members for ${t} in ${installedGitHubClient.GetCurrentOrgName()}`)
        await SynchronizeGitHubTeam(installedGitHubClient, t, config);
    }
}