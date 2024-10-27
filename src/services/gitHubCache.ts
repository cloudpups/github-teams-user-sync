import { ILogger } from "../logging";
import { AddMemberResponse, CopilotAddResponse, GitHubTeamId, IInstalledClient as IInstalledClient, IRawInstalledGitHubClient, OrgConfigResponse, OrgInvite, OrgRoles, RemoveMemberResponse, Response } from "./gitHubTypes";
import { ICacheClient } from "./CacheClient";

/**
 * This class decorates the InstalledClient with additional caching logic. In general, 
 * this logic should be kept simple. However, in an effort to reduce the bleeding of
 * complex logic into the concrete InstalledClient implementations, some complexity
 * may be acceptable here (such as checking for eTag and then retrying a call).
 * 
 * Chain of responsibility:
 * 
 * eTag checker
 * if there are no changes, check cache and return
    * if cache has nothing, call client, cache value, then return
 * if there are changes, check client, cache changes and etag, return
 */
export class GitHubClientCache implements IInstalledClient {
    constructor(private client: IRawInstalledGitHubClient, private cacheClient: ICacheClient, private logger: ILogger) { }

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
        const cacheKey = `github-member-1:${id}-${this.GetCurrentOrgName()}`;

        const result = await this.cacheClient.get(cacheKey);

        if (result) {
            this.ReportCacheHit({
                cacheKey: cacheKey,
                operation: "IsUserMember",
                value: JSON.stringify(result),
                user: id
            });

            return {
                successful: true,
                data: Boolean(result)
            }
        }

        const actualResult = await this.client.IsUserMember(id);

        if (actualResult.successful) {
            // TODO: switch all cache expirations to application configuration values.  

            const userIsMember = actualResult.data;

            if (userIsMember) {
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
            this.ReportCacheHit({
                operation: "DoesUserExist",
                user: gitHubId,
                value: result,
                cacheKey: cacheKey
            });

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

    async ListCurrentMembersOfGitHubTeam(team: string): Response<string[]> {
        const teamSlug = `${this.GetCurrentOrgName()}_${team}`;
        const eTagCacheKey = `t-e:${teamSlug}`;
        const teamCacheKey = `t:${teamSlug}`;

        const cachedEtag = await this.cacheClient.get(eTagCacheKey) ?? "";

        const eTagResponse = await this.client.ListMembersOfTeamEtagCheck(team, cachedEtag);        

        if (eTagResponse.successful == false) {            
            return {
                successful: false
            }
        }        

        this.ReportCacheHit({
            operation: "eTag-TeamMembers",
            team: team,
            value: cachedEtag,
            cacheKey: eTagCacheKey
        })

        let newETag = "";
        let teamMembers: string[] | undefined = undefined;        

        if (eTagResponse.successful == "no_changes") {
            newETag = eTagResponse.eTag;            

            const cachedTeamMembers = await this.cacheClient.get(teamCacheKey);            
            
            if (cachedTeamMembers) {                
                teamMembers = JSON.parse(cachedTeamMembers);
                this.ReportCacheHit({
                    operation: "TeamMembers",
                    team: team,
                    value: cachedTeamMembers,
                    cacheKey: teamCacheKey
                })
            }
            else {                
                const newTeamMembersResponse = await this.client.ListCurrentMembersOfGitHubTeam(team);

                if (newTeamMembersResponse.successful == false) {                    
                    return {
                        successful: false
                    }
                }

                await this.cacheClient.set(teamCacheKey, JSON.stringify(newTeamMembersResponse.data), { EX: fourteenDaysInSeconds });
                teamMembers = newTeamMembersResponse.data;
            }
        }

        if (eTagResponse.successful == true) {
            newETag = eTagResponse.data;
            const newTeamMembersResponse = await this.client.ListCurrentMembersOfGitHubTeam(team);

            if (newTeamMembersResponse.successful == false) {                
                return {
                    successful: false
                }
            }

            await this.cacheClient.set(teamCacheKey, JSON.stringify(newTeamMembersResponse.data), { EX: fourteenDaysInSeconds });
            teamMembers = newTeamMembersResponse.data;
        }

        await this.cacheClient.set(eTagCacheKey, newETag, { EX: fourteenDaysInSeconds });

        if (teamMembers === undefined) {            
            return {
                successful: false
            }
        }

        return {
            successful: true,
            data: teamMembers
        };
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

    private ReportCacheHit(props: { operation: string, user?: string, team?: string, value: string, cacheKey: string }) {
        const properties: any = {
            "Group": "GitHub",
            "Operation": props.operation,
            "Org": this.GetCurrentOrgName(),
            "Value": props.value,
            "CacheKey": props.cacheKey
        };

        if (props.user) {
            properties["User"] = props.user;
        }

        if (props.team) {
            properties["Team"] = props.team;
        }

        this.logger.ReportEvent({
            Name: "CacheHit",
            properties: properties
        });
    }
}

const twoDaysInSeconds = 172_800;
const fourteenDaysInSeconds = 1_209_600;