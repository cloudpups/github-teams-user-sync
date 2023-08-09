import { CacheClient } from "../app";
import { GitHubTeamId, InstalledClient, OrgConfiguration, Response } from "./gitHubTypes";

export class GitHubClientCache implements InstalledClient {
    client: InstalledClient;
    cacheClient: CacheClient;

    constructor(client: InstalledClient, cacheClient: CacheClient) {
        this.client = client;
        this.cacheClient = cacheClient;
    }

    GetCurrentOrgName(): string {
        return this.client.GetCurrentOrgName();
    }

    GetCurrentRateLimit(): Promise<{ remaining: number; }> {
        return this.client.GetCurrentRateLimit();
    }

    AddOrgMember(id: string): Response<unknown> {
        return this.client.AddOrgMember(id);
    }

    async IsUserMember(id: string): Response<boolean> {        
        const cacheKey = `github-member:${id}-${this.GetCurrentOrgName()}`;

        const result = await this.cacheClient.get(cacheKey);        

        if (result) {
            return {
                successful: true,
                data: Boolean(result)
            }
        }        

        const actualResult = await this.client.IsUserMember(id);
        
        if (actualResult.successful) {            
            await this.cacheClient.set(cacheKey, actualResult.data.toString(), {
                EX: 172800 // Expire every 2 days
            });            
        }

        return actualResult;    
    }

    GetAllTeams(): Response<GitHubTeamId[]> {
        return this.client.GetAllTeams();
    }

    AddTeamMember(team: string, id: string): Response<unknown> {
        return this.client.AddTeamMember(team, id);
    }

    CreateTeam(teamName: string, description: string): Response<unknown> {
        return this.client.CreateTeam(teamName, description);
    }

    async DoesUserExist(gitHubId: string): Response<string> {
        const cacheKey = `github-user:${gitHubId}`;

        const result = await this.cacheClient.get(cacheKey);        

        if (result) {
            return {
                successful: true,
                data: result
            }
        }        

        const actualResult = await this.client.DoesUserExist(gitHubId);

        if (actualResult.successful) {
            await this.cacheClient.set(cacheKey, actualResult.data, {
                EX: 2592000 // Expire every 30 days
            });
        }

        return actualResult;
    }

    ListCurrentMembersOfGitHubTeam(team: string): Response<string[]> {
        return this.client.ListCurrentMembersOfGitHubTeam(team);
    }

    RemoveTeamMemberAsync(team: string, user: string): Response<unknown> {
        return this.client.RemoveTeamMemberAsync(team, user);
    }

    UpdateTeamDetails(team: string, description: string): Response<unknown> {
        return this.client.UpdateTeamDetails(team, description);
    }

    AddSecurityManagerTeam(team: string): Promise<unknown> {
        return this.client.AddSecurityManagerTeam(team);
    }

    GetConfigurationForInstallation(): Response<OrgConfiguration> {
        return this.client.GetConfigurationForInstallation();
    }

    GetOrgMembers(): Response<string[]> {
        return this.client.GetOrgMembers();
    }
}