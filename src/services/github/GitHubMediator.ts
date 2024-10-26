import { AddMemberResponse, CopilotAddResponse, GitHubTeamId, IRawInstalledGitHubClient, InstalledClient, OrgConfigResponse, OrgInvite, OrgRoles, RemoveMemberResponse, Response } from "../gitHubTypes";
import { IGitHubCache } from "./IGitHubCache";

export class GitHubMediator implements InstalledClient {
    constructor(
        private client: InstalledClient, 
        private rawClient:IRawInstalledGitHubClient, 
        private eTagCache: IGitHubEtagCache,
        private gitHubCache: IGitHubCache
    ) { }

    GetCurrentOrgName(): string {
        return this.client.GetCurrentOrgName();
    }

    GetCurrentRateLimit(): Promise<{ remaining: number; }> {
        return this.client.GetCurrentRateLimit();
    }

    AddOrgMember(id: string): Response<unknown> {
        return this.client.AddOrgMember(id);
    }

    IsUserMember(id: string): Response<boolean> {
        return this.client.IsUserMember(id);
    }

    GetAllTeams(): Response<GitHubTeamId[]> {
        return this.client.GetAllTeams();
    }

    AddTeamMember(team: string, id: string): AddMemberResponse {
        return this.client.AddTeamMember(team, id);
    }
    
    CreateTeam(teamName: string, description: string): Response<unknown> {
        return this.client.CreateTeam(teamName, description);
    }

    DoesUserExist(gitHubId: string): Response<string> {
        return this.client.DoesUserExist(gitHubId);
    }

    async ListCurrentMembersOfGitHubTeam(team: string): Response<string[]> {        
        const existingEtag = await this.eTagCache.getTeamMemberEtag(this.GetCurrentOrgName(), team);

        // will return an empty string even if not found as an empty etag works fine for 
        // future API calls.        
        const response = await this.rawClient.RawListCurrentMembersOfGitHubTeam(team, existingEtag);

        if (response.successful == false) {
            // Propagate the error
            return response;
        }

        if(response.successful == "no_changes") { 
            // If no changes, simply load whatever is in the cache           
            const members = await this.gitHubCache.getTeamMembers(this.GetCurrentOrgName(), team);
            return {
                successful: true,
                data: members
            }
        }

        // If we got here, then there are changes. We must cache both the GitHub Team Members, as 
        // well as the eTag.
        const newMembersResponse = await this.client.ListCurrentMembersOfGitHubTeam(team);

        if(newMembersResponse.successful == false) {
            return response;
        }        

        await this.eTagCache.setTeamMemberEtag(this.GetCurrentOrgName(), team, response.eTag);
        await this.gitHubCache.setTeamMembers(this.GetCurrentOrgName(), team, response.data);

        return {
            successful: true,
            data: response.data
        }
    }

    RemoveTeamMemberAsync(team: string, user: string): RemoveMemberResponse {
        return this.client.RemoveTeamMemberAsync(team, user);
    }

    UpdateTeamDetails(team: string, description: string): Response<unknown> {
        return this.client.UpdateTeamDetails(team, description);
    }

    AddSecurityManagerTeam(team: string): Promise<unknown> {
        return this.client.AddSecurityManagerTeam(team);
    }

    GetConfigurationForInstallation(): OrgConfigResponse {
        return this.client.GetConfigurationForInstallation();
    }

    SetOrgRole(id: string, role: OrgRoles): Response<unknown> {
        return this.client.SetOrgRole(id, role);
    }

    GetPendingOrgInvites(): Response<OrgInvite[]> {
        return this.client.GetPendingOrgInvites();
    }

    CancelOrgInvite(invite: OrgInvite): Response<unknown> {
        return this.client.CancelOrgInvite(invite);
    }

    ListPendingInvitesForTeam(teamName: string): Response<OrgInvite[]> {
        return this.client.ListPendingInvitesForTeam(teamName);
    }

    AddTeamsToCopilotSubscription(teamNames: string[]): Response<CopilotAddResponse[]> {
        return this.client.AddTeamsToCopilotSubscription(teamNames);
    }
}