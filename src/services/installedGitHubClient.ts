import { Octokit, PageInfoForward } from "octokit";
import { AddMemberResponse, CopilotAddResponse, GitHubClient, GitHubId, GitHubTeamId, InstalledClient, Org, OrgConfigResponse, OrgInvite, OrgRoles, RawResponse, RemoveMemberResponse, Response } from "./gitHubTypes";
import yaml from "js-yaml";
import { AsyncReturnType, MakeTeamNameSafeAndApiFriendly } from "../utility";
import { Log, LogError } from "../logging";
import { GitHubTeamName, OrgConfig, OrgConfigurationOptions } from "./orgConfig";
// import * as query from "./teamMembers.gql";

export class InstalledGitHubClient implements InstalledClient {
    gitHubClient: Octokit;
    orgName: string;

    constructor(gitHubClient: Octokit, orgName: string) {
        this.gitHubClient = gitHubClient;
        this.orgName = orgName;
    }

    async AddTeamsToCopilotSubscription(teamNames: string[]): Response<CopilotAddResponse[]> {
        // Such logic should not generally go in a facade, though the convenience
        // and lack of actual problems makes this violation of pattern more "okay."
        if (teamNames.length < 1) {
            return {
                // Should be "no op"
                successful: true,
                data: []
            }
        }

        const responses: CopilotAddResponse[] = [];

        for (const team of teamNames) {
            try {
                const response = await this.gitHubClient.request("POST /orgs/{org}/copilot/billing/selected_teams", {
                    org: this.orgName,
                    selected_teams: [team],
                    headers: {
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });

                if (response.status < 200 || response.status > 299) {
                    responses.push({
                        successful: false,
                        team: team,
                        message: response.status.toString()
                    });
                }

                responses.push({
                    successful: true,
                    team: team
                });
            }
            catch (e) {
                console.log(e);
                responses.push({
                    successful: false,
                    team: team,
                    message: JSON.stringify(e)
                });
            }
        }

        return {
            successful: true,
            data: responses
        };
    }

    async ListPendingInvitesForTeam(teamName: string): Response<OrgInvite[]> {
        const safeName = MakeTeamNameSafeAndApiFriendly(teamName);

        const response = await this.gitHubClient.rest.teams.listPendingInvitationsInOrg({
            org: this.orgName,
            team_slug: safeName
        })

        if (response.status < 200 || response.status > 299) {
            return {
                successful: false
            }
        }

        return {
            successful: true,
            data: response.data.map(i => {
                return {
                    GitHubUser: i.login!,
                    InviteId: i.id!
                }
            })
        }
    }

    async CancelOrgInvite(invite: OrgInvite): Response<unknown> {
        const response = await this.gitHubClient.rest.orgs.cancelInvitation({
            invitation_id: invite.InviteId,
            org: this.orgName
        })

        if (response.status < 200 || response.status > 299) {
            return {
                successful: false
            }
        }

        return {
            successful: true,
            data: null
        }
    }

    async GetPendingOrgInvites(): Response<OrgInvite[]> {
        const response = await this.gitHubClient.paginate(this.gitHubClient.rest.orgs.listPendingInvitations, {
            org: this.orgName,
            role: "all",
            headers: {
                "x-github-api-version": "2022-11-28"
            }
        })

        return {
            successful: true,
            data: (response)?.map(d => {
                return {
                    InviteId: d.id,
                    GitHubUser: d.login!
                }
            }) ?? []
        }
    }

    public async SetOrgRole(id: GitHubId, role: OrgRoles): Response {
        const response = await this.gitHubClient.rest.orgs.setMembershipForUser({
            org: this.orgName,
            username: id,
            role: role
        })

        if (response.status > 200 && response.status < 300) {
            return {
                successful: true,
                data: null
            }
        }

        return {
            successful: false
        }
    }

    public GetCurrentOrgName(): string {
        return this.orgName;
    }

    public async GetCurrentRateLimit(): Promise<{ remaining: number; }> {
        const limits = await this.gitHubClient.rest.rateLimit.get();

        return {
            remaining: limits.data.rate.remaining
        }
    }

    public async AddOrgMember(id: string): Response<boolean> {
        try {
            const response = await this.gitHubClient.rest.orgs.setMembershipForUser({
                org: this.orgName,
                username: id
            })

            if (response.status != 200) {
                return {
                    successful: false
                }
            }

            return {
                successful: false
            }
        }
        catch (e) {
            LogError(`Error adding Org Member ${id}: ${JSON.stringify(e)}`)

            return {
                successful: false
            }
        }
    }

    public async IsUserMember(id: string): Response<boolean> {
        try {
            await this.gitHubClient.rest.orgs.checkMembershipForUser({
                org: this.orgName,
                username: id
            })
        }
        catch {
            // TODO: actually catch exception and investigate...
            // not all exceptions could mean that the user is not a member
            return {
                successful: true,
                data: false
            }
        }

        return {
            successful: true,
            data: true
        }
    }

    public async GetAllTeams(): Response<GitHubTeamId[]> {
        const response = await this.gitHubClient.paginate(this.gitHubClient.rest.teams.list, {
            org: this.orgName
        })

        const teams = response.map(i => {
            return {
                Id: i.id,
                Name: i.name
            }
        });

        return {
            successful: true,
            data: teams
        }
    }

    public async AddTeamMember(team: GitHubTeamName, id: GitHubId): AddMemberResponse {
        const safeTeam = MakeTeamNameSafeAndApiFriendly(team);

        try {
            await this.gitHubClient.rest.teams.addOrUpdateMembershipForUserInOrg({
                org: this.orgName,
                team_slug: safeTeam,
                username: id
            })

            return {
                successful: true,
                team: team,
                user: id
            }
        }
        catch (e) {
            if (e instanceof Error) {
                return {
                    successful: false,
                    team: team,
                    user: id,
                    message: e.message
                }
            }

            return {
                successful: false,
                team: team,
                user: id,
                message: JSON.stringify(e)
            }
        }
    }

    public async CreateTeam(team: GitHubTeamName, description: string): Response<unknown> {
        try {
            // TODO: submit bug for the method I was using because
            // it always creates a team with '-' instead of spaces...
            // this is NOT an opinion for a client library to make!
            await this.gitHubClient.request('POST /orgs/{org}/teams', {
                org: this.orgName,
                name: team,
                description: description,
                // TODO: enable configuration of this item                
                notification_setting: 'notifications_enabled',
                // TODO: enable configuration of this item
                privacy: 'closed',
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
        }
        catch {
            return {
                successful: false
            }
        }

        return {
            successful: true,
            // TODO: make this type better to avoid nulls...
            data: null
        }
    }

    public async DoesUserExist(gitHubId: string): Response<GitHubId> {
        try {
            const response = await this.gitHubClient.rest.users.getByUsername({
                username: gitHubId
            })

            return {
                successful: true,
                data: response.data.login
            }
        }
        catch {
            return {
                successful: false
            }
        }
    }

    public async ListCurrentMembersOfGitHubTeam(team: GitHubTeamName): Response<GitHubId[]> {
        const safeTeam = MakeTeamNameSafeAndApiFriendly(team);

        try {
            const response = await this.gitHubClient.graphql.paginate<MembersResponseType>(actualQuery, {
                org: this.GetCurrentOrgName(),
                team: safeTeam
            });

            console.log(response);

            return {
                successful: true,
                data: response.organization.team.members.nodes.map(i => i.login)
            }
        }
        catch (e) {
            console.log(e);
            return {
                successful: false
            }
        }
    }

    public async RemoveTeamMemberAsync(team: GitHubTeamName, user: GitHubId): RemoveMemberResponse {
        const safeTeam = MakeTeamNameSafeAndApiFriendly(team);

        try {
            await this.gitHubClient.rest.teams.removeMembershipForUserInOrg({
                team_slug: safeTeam,
                org: this.orgName,
                username: user
            })

            return {
                successful: true,
                team: team,
                user: user
            }
        }
        catch (e) {
            if (e instanceof Error) {
                return {
                    successful: false,
                    team: team,
                    user: user,
                    message: e.message
                }
            }

            return {
                successful: false,
                team: team,
                user: user,
                message: JSON.stringify(e)
            }
        }
    }

    public async UpdateTeamDetails(team: GitHubTeamName, description: string): Response<unknown> {
        try {
            await this.gitHubClient.rest.teams.updateInOrg({
                org: this.orgName,
                privacy: "closed",
                team_slug: MakeTeamNameSafeAndApiFriendly(team),
                name: team,
                description: description
            })

            return {
                successful: true,
                // TODO: make this type better to avoid nulls...
                data: null
            }
        }
        catch {
            return {
                successful: false
            }
        }
    }

    public async AddSecurityManagerTeam(team: GitHubTeamName) {
        const safeTeam = MakeTeamNameSafeAndApiFriendly(team);

        try {
            await this.gitHubClient.rest.orgs.addSecurityManagerTeam({
                org: this.orgName,
                team_slug: safeTeam
            })
            return true;
        }
        catch {
            Log(`Error adding ${team} as Security Managers for Org ${this.orgName}.`)
            return false;
        }

    }

    public async GetConfigurationForInstallation(): OrgConfigResponse {
        // TODO: this function doesn't really belong on this class...
        // i.e., it doesn't fit with a "GitHub Facade"
        const getContentRequest = {
            owner: this.orgName,
            repo: ".github",
            path: ""
        };

        let filesResponse: AsyncReturnType<typeof this.gitHubClient.rest.repos.getContent>;

        try {
            filesResponse = await this.gitHubClient.rest.repos.getContent(getContentRequest);
        }
        catch {
            return {
                successful: false,
                state: "NoConfig"
            }
        }

        const potentialFiles = filesResponse.data;

        if (!Array.isArray(potentialFiles)) {
            return {
                successful: false,
                state: "NoConfig"
            }
        }

        const onlyConfigFiles = potentialFiles
            .filter(i => i.type == "file")
            .filter(i => i.name == "team-sync-options.yml" || i.name == "team-sync-options.yaml");

        if (onlyConfigFiles.length > 1) {
            return {
                successful: false,
                state: "BadConfig",
                message: "Multiple configuration files are not supported at this point in time."
            }
        }

        if (onlyConfigFiles.length < 1) {
            return {
                successful: false,
                state: "NoConfig",
                message: "No configuration file exists in the configuration repository (typically the .github repository)."
            }
        }

        const onlyFile = onlyConfigFiles[0];

        const contentResponse = await this.gitHubClient.rest.repos.getContent({
            ...getContentRequest,
            path: onlyFile.name
        })

        const contentData = contentResponse.data;

        if (Array.isArray(contentData) || contentData.type != "file") {
            return {
                successful: false,
                state: "BadConfig"
            }
        }

        try {
            const configuration = yaml.load(Buffer.from(contentData.content, 'base64').toString()) as OrgConfigurationOptions;
            return {
                successful: true,
                data: new OrgConfig(configuration)
            }
        }
        catch {
            return {
                successful: false,
                state: "BadConfig",
                message: "Error parsing configuration- check configuration file for validity: https://github.com/cloudpups/github-teams-user-sync/blob/main/docs/OrganizationConfiguration.md"
            }
        }
    }

    public async RawListCurrentMembersOfGitHubTeam(team: string, eTag: string): RawResponse<string[]> {
        const safeTeam = MakeTeamNameSafeAndApiFriendly(team);

        try {
            /* Unfortunately the GitHub GraphQL API doesn't support eTags, and the REST API for listing
            members of a team lists all members of all teams, including child teams.
            As such, a change to any child team will result in the re-fetching of the parent team.                                    
            
            per_page is set to 1 to minimize the amount of data returned, as we only need to know if 
            there are changes with this call (which is determined by a 304 status code, which results 
            in an exception). While one may want to consider saving some API calls by leveraging the 
            `link` header to determine if there are more pages, this is not done here as the REST API
            for teams will return members from child teams, which is not what we want... It is only via
            the GraphQL API that we can get the members of a specific team. */
            await this.gitHubClient.rest.teams.listMembersInOrg({
                org: this.orgName,
                team_slug: safeTeam,
                per_page: 1,
                headers: {
                    'If-None-Match': eTag
                }
            });

            // if the above completes successfully, then there are changes and we must leverage the 
            // GraphQL API to get the members of JUST the team in question (see comment above about the REST API).                            
            const response = await this.gitHubClient.graphql.paginate(actualQuery, {
                org: this.GetCurrentOrgName(),
                team: team
            });

            return {
                successful: true,
                data: [], //response.data.map(i => i.login),
                eTag: response.headers.etag! // This call will always result in an eTag if successful
            }
        }
        catch (error) {
            const typedError = error as { status: number };

            if (typedError.status == 304) {
                return {
                    successful: "no_changes"
                }
            }

            return {
                successful: false
            }
        }
    }
}

const actualQuery = `query($org:String!, $team:String!, $cursor:String) {
    organization(login:$org) {
        team(slug:$team) {
            members(first:100, membership:IMMEDIATE, after:$cursor) {
                nodes{          
                    login                
                },
                pageInfo {
                    endCursor          
                    hasNextPage          
                }
            }
        }
    }
}`

type Member = {
    login: string;
};

type MembersResponseType = {
    organization: {
        team: {
            members: {
                nodes: Member[];
                pageInfo: PageInfoForward;
            };
        };
    };
};