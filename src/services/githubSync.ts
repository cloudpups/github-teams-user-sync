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

export async function SynchronizeOrgMembers(installedGitHubClient:InstalledClient, teamName:string, config:AppConfig) {    
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

export async function SynchronizeGitHubTeam(installedGitHubClient:InstalledClient, teamName:string, config:AppConfig) {
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