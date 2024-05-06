import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { Config } from "../config";
import { AddMemberResponse, CopilotAddResponse, GitHubClient, GitHubId, GitHubTeamId, InstalledClient, Org, OrgInvite, OrgRoles, RemoveMemberResponse, Response } from "./gitHubTypes";
import { AppConfig } from "./appConfig";
import yaml from "js-yaml";
import { throttling } from "@octokit/plugin-throttling";
import { AsyncReturnType } from "../utility";
import { Log, LoggerToUse } from "../logging";
import { GitHubClientCache } from "./gitHubCache";
import { redisClient } from "../app";
import { GitHubTeamName, OrgConfig, OrgConfigurationOptions } from "./orgConfig";

const config = Config();

// TODO: split into decorator so as to not mix responsibilities
function MakeTeamNameSafe(teamName: string) {
    // There are most likely much more than this...
    const specialCharacterRemoveRegexp = /[ &%#@!$]/g;
    const saferName = teamName.replaceAll(specialCharacterRemoveRegexp, '-');

    const multiReplaceRegexp = /(-){2,}/g;
    const removeTrailingDashesRegexp = /-+$/g

    const withDuplicatesRemoved = saferName.replaceAll(multiReplaceRegexp, "-").replaceAll(removeTrailingDashesRegexp, "");

    return withDuplicatesRemoved;
}

// TODO: split into decorator so as to not mix responsibilities
function MakeTeamNameSafeAndApiFriendly(teamName: string) {
    return MakeTeamNameSafe(teamName).replace(" ", "-");
}

async function GetOrgClient(installationId: number): Promise<InstalledClient> {
    // TODO: look further into this... it seems like it would be best if 
    // installation client was generated from the original client, and not
    // created fresh.    
    const MyOctokit = Octokit.plugin(throttling);

    const installedOctokit = new MyOctokit({
        authStrategy: createAppAuth,
        auth: {
            appId: Config().GitHub.AppId,
            privateKey: Config().GitHub.PrivateKey,
            installationId
        },
        throttle: {
            onRateLimit: (retryAfter, options, octokit, retryCount) => {
                octokit.log.warn(
                    `Request quota exhausted for request ${options.method} ${options.url}`
                );

                if (retryCount < 10) {
                    // retries 10 times
                    octokit.log.info(`Retrying after ${retryAfter} seconds!`);
                    return true;
                }
            },
            onSecondaryRateLimit: (retryAfter, options, octokit) => {
                // does not retry, only logs a warning
                octokit.log.warn(
                    `SecondaryRateLimit detected for request ${options.method} ${options.url}. Retry after ${retryAfter} seconds`
                );

                return true;
            },
        }
    })

    const orgName = await installedOctokit.rest.apps.getInstallation({ installation_id: installationId })!;

    type thisShouldNotBeNeeded = {
        // TODO: keep an eye on this as there is a good 
        // chance login will be removed considering it
        // is already not present on the type...
        login: string
    }

    // HACK: gross typing nonsense
    if (!(orgName.data.account! as thisShouldNotBeNeeded).login) {
        // TODO: throw custom wrapped error...
        throw new Error("Login cannot be null for orgs")
    }

    // HACK: gross typing nonsense
    const baseClient = new InstalledGitHubClient(installedOctokit, (orgName.data.account as thisShouldNotBeNeeded).login);

    if (Config().AppOptions.RedisHost) {
        const cachedClient = new GitHubClientCache(baseClient, redisClient, LoggerToUse());
        return cachedClient;
    }

    return baseClient;
}

function authenticatedClient() {
    const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: Config().GitHub.AppId,
            privateKey: Config().GitHub.PrivateKey,
        }
    })

    return appOctokit;
}

async function GetInstallations(client: Octokit): Promise<Org[]> {
    try {
        const installationList = await client.paginate(client.rest.apps.listInstallations, {
            per_page: 100
        })

        // TODO: this function is doing too much, it is not 
        // just a simple facade anymore...
        const mappedOrgs = installationList.map(i => {
            const account = i.account!;

            return {
                id: i.id,
                orgName: account.login ?? "",
                suspendedAt: i.suspended_at,
                suspendedBy: i.suspended_by?.login
            }
        });

        const suspendedInstallations = mappedOrgs.filter(i => i.suspendedAt != undefined);

        Log(`The following installations have been suspended: ${JSON.stringify(suspendedInstallations)}`)

        return mappedOrgs.filter(i => i.suspendedAt == undefined).map(i => {
            return {
                id: i.id,
                orgName: i.orgName
            }
        });
    }
    catch {
        // TODO: log error
        return [] as Org[]
    }
}

async function GetAppConfig(client: Octokit): Promise<AppConfig> {
    const installationList = await GetInstallations(client);

    const configOrg = installationList.filter(i => i.orgName == config.AppOptions.AppConfigOrg)[0]

    const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: config.GitHub.AppId,
            privateKey: config.GitHub.PrivateKey,
            installationId: configOrg.id
        }
    })

    const getContentRequest = {
        owner: configOrg.orgName,
        repo: config.AppOptions.AppConfigRepo,
        path: ""
    };

    const filesResponse = await appOctokit.rest.repos.getContent(getContentRequest);

    const potentialFiles = filesResponse.data;

    if (!Array.isArray(potentialFiles)) {
        throw new Error("AppConfig not found!")
    }

    const onlyConfigFiles = potentialFiles
        .filter(i => i.type == "file")
        .filter(i => i.name == "sync-app-config.yml" || i.name == "sync-app-config.yaml");

    if (onlyConfigFiles.length != 1) {
        throw new Error("AppConfig not found!")
    }

    const onlyFile = onlyConfigFiles[0];

    const contentResponse = await appOctokit.rest.repos.getContent({
        ...getContentRequest,
        path: onlyFile.name
    })

    const contentData = contentResponse.data;

    if (Array.isArray(contentData) || contentData.type != "file") {
        throw new Error("AppConfig not found!")
    }

    type RawAppConfig = {
        GitHubIdAppend?: string
        SecurityManagerTeams?: string[]
        Description?: {
            ShortLink: string
        }
        TeamsToIgnore?: string[]
    }

    const configuration = yaml.load(Buffer.from(contentData.content, 'base64').toString()) as RawAppConfig;

    return {
        Description: configuration.Description ?? { ShortLink: "https://github.com/cloudpups/github-teams-user-sync" },
        SecurityManagerTeams: configuration.SecurityManagerTeams ?? [],
        TeamsToIgnore: configuration.TeamsToIgnore ?? [],
        GitHubIdAppend: configuration.GitHubIdAppend ?? ""
    };
}


export function GetClient(): GitHubClient {
    const client = authenticatedClient();
    return {
        GetInstallations: () => GetInstallations(client),
        GetOrgClient: (installationId: number) => GetOrgClient(installationId),
        GetAppConfig: () => GetAppConfig(client)
    }
}


class InstalledGitHubClient implements InstalledClient {
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

    public async GetOrgMembers(): Response<GitHubId[]> {
        const response = await this.gitHubClient.paginate(this.gitHubClient.rest.orgs.listMembers, {
            org: this.orgName
        })

        return {
            successful: true,
            data: response.map(i => {
                return i.login
            })
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
            const response = await this.gitHubClient.paginate(this.gitHubClient.rest.teams.listMembersInOrg, {
                org: this.orgName,
                team_slug: safeTeam,
            })

            return {
                successful: true,
                data: response.map(i => {
                    return i.login
                })
            }
        }
        catch {
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

    public async GetConfigurationForInstallation(): Response<OrgConfig> {
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
                successful: false
            }
        }

        const potentialFiles = filesResponse.data;

        if (!Array.isArray(potentialFiles)) {
            return {
                successful: false
            }
        }

        const onlyConfigFiles = potentialFiles
            .filter(i => i.type == "file")
            .filter(i => i.name == "team-sync-options.yml" || i.name == "team-sync-options.yaml");

        if (onlyConfigFiles.length != 1) {
            return {
                successful: false
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
                successful: false
            }
        }

        const configuration = yaml.load(Buffer.from(contentData.content, 'base64').toString()) as OrgConfigurationOptions;

        return {
            successful: true,
            data: new OrgConfig(configuration)
        }
    }
}