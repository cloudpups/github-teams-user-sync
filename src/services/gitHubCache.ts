import { CacheClient } from "../app";
import { ILogger } from "../logging";
import { AddMemberResponse, CopilotAddResponse, GitHubId, GitHubTeamId, InstalledClient, OrgConfigResponse, OrgInvite, OrgRoles, RemoveMemberResponse, Response } from "./gitHubTypes";
import { OrgConfig } from "./orgConfig";

export class GitHubClientCache implements InstalledClient {
    client: InstalledClient;
    cacheClient: CacheClient;
    logger:ILogger;

    constructor(client: InstalledClient, cacheClient: CacheClient, logger:ILogger) {
        this.client = client;
        this.cacheClient = cacheClient;
        this.logger = logger;
    }
    AddTeamsToCopilotSubscription(teamNames: string[]): Response<CopilotAddResponse[]> {
        return this.client.AddTeamsToCopilotSubscription(teamNames);
    }
    
    ListPendingInvitesForTeam(teamName: string): Response<OrgInvite[]> {
        return this.client.ListPendingInvitesForTeam(teamName);
    }
    
    CancelOrgInvite(invite: OrgInvite): Response<unknown> {
        return this.client.CancelOrgInvite(invite);
    }

    GetPendingOrgInvites(): Response<OrgInvite[]> {
        return this.client.GetPendingOrgInvites();
    }

    SetOrgRole(id: string, role: OrgRoles): Response<unknown> {
        return this.client.SetOrgRole(id, role);
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
            this.logger.ReportEvent({
                Name:"CacheHit",
                properties: {
                    "Data": id,
                    "Operation": "IsUserMember",
                    "Group": "GitHub",
                    "Value": result
                }
            })

            return {
                successful: true,
                data: Boolean(result)
            }
        }        

        const actualResult = await this.client.IsUserMember(id);
        
        if (actualResult.successful) {          
            // TODO: switch all cache expirations to application configuration values.  
            
            const userIsMember = actualResult.data;

            if(userIsMember) {
                await this.cacheClient.set(cacheKey, userIsMember.toString(), {
                    EX: 172800 // Expire every 2 days                    
                });   
            }
            else {
                // If membership check comes back as "not a member," we still want to cache
                // the value so that we aren't hitting GitHub's APIs "too much."      
                // With that being said, we don't want to cache it for "too long" as then 
                // it will start to cause user abrasion.          
                await this.cacheClient.set(cacheKey, userIsMember.toString(), {
                    EX: 1800 // Expire every 30 minutes
                    // It is unlikely that 30 minutes will cause much pain
                });   
            }              
        }

        return actualResult;    
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

    async DoesUserExist(gitHubId: string): Response<string> {
        const cacheKey = `github-user-2:${gitHubId}`;

        const result = await this.cacheClient.get(cacheKey);        

        if (result) {            
            this.logger.ReportEvent({
                Name:"CacheHit",
                properties: {
                    "Data": gitHubId,
                    "Operation": "DoesUserExist",
                    "Group": "GitHub",
                    "Value": result
                }
            })

            return JSON.parse(result);
        }        

        const actualResult = await this.client.DoesUserExist(gitHubId);

        if (actualResult.successful) {
            await this.cacheClient.set(cacheKey, JSON.stringify(actualResult), {
                EX: 2592000 // Expire every 30 days
            });
        }
        else {
            // While this caching logic is a bit more complex than I'd like
            // (i.e., contains conditional), I believe it is appropriate given
            // the context. A user is much more likely to exist for a long 
            // time than *not exist,* though it is also likely that a user will
            // not exist for a short period of time once they realize they do 
            // not exist...
            await this.cacheClient.set(cacheKey, JSON.stringify(actualResult), {
                EX: 1800 // Expire every 30 minutes
                // It is unlikely that 30 minutes will cause much pain
            });
        }

        return actualResult;
    }

    ListCurrentMembersOfGitHubTeam(team: string): Response<string[]> {
        return this.client.ListCurrentMembersOfGitHubTeam(team);
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
}