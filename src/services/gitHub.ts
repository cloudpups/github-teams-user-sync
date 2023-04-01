import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { Config } from "../config";
import { GitHubClient, GitHubId, GitHubTeamId, GitHubTeamName, InstalledClient, Org, OrgConfiguration, Response } from "./gitHubTypes";
import { AppConfig } from "./appConfig";
import yaml from "js-yaml";
import { throttling } from "@octokit/plugin-throttling";
import { AsyncReturnType } from "../utility";

const config = Config();

function MakeTeamNameSafe(teamName:string) {
    // There are most likely much more than this...
    const specialCharacterRemoveRegexp = /[ &%#@!$]/g;
    const saferName = teamName.replaceAll(specialCharacterRemoveRegexp, '-');

    const multiReplaceRegexp = /(-){2,}/g;
    const removeTrailingDashesRegexp = /-+$/g
    
    const withDuplicatesRemoved = saferName.replaceAll(multiReplaceRegexp, "-").replaceAll(removeTrailingDashesRegexp, "");
    
    return withDuplicatesRemoved;
}

async function GetOrgClient(installationId: number): Promise<InstalledClient> {
    interface options {
        method:string
        url:string
    }

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
            onRateLimit: (retryAfter:number, options:options, octokit:Octokit, retryCount:number) => {
              octokit.log.warn(
                `Request quota exhausted for request ${options.method} ${options.url}`
              );
        
              if (retryCount < 10) {
                // retries 10 times
                octokit.log.info(`Retrying after ${retryAfter} seconds!`);
                return true;
              }
            },
            onSecondaryRateLimit: (retryAfter:number, options:options, octokit:Octokit) => {
              // does not retry, only logs a warning
              octokit.log.warn(
                `SecondaryRateLimit detected for request ${options.method} ${options.url}. Retry after ${retryAfter} seconds`
              );              

              return true;
            },
          }          
    })

    const orgName = await installedOctokit.rest.apps.getInstallation({ installation_id: installationId });

    if(!orgName.data.account?.login) {
        // TODO: throw custom wrapped error...
        throw new Error("Login cannot be null for orgs")
    }

    // TODO: wrap in caching decorator 
    return new InstalledGitHubClient(installedOctokit, orgName.data.account?.login);
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
    const installationList = await client.paginate(client.rest.apps.listInstallations, {
        per_page: 100
    })    

    const mappedOrgs = installationList.map(i => {
        return {
            id: i.id,
            orgName: i.account?.login ?? "",
            suspendedAt: i.suspended_at,
            suspendedBy: i.suspended_by?.login
        }
    });

    const suspendedInstallations = mappedOrgs.filter(i => i.suspendedAt != undefined);

    console.log(`The following installations have been suspended: ${JSON.stringify(suspendedInstallations)}`)

    return mappedOrgs.filter(i => i.suspendedAt == undefined).map(i => {
        return {
            id: i.id,
            orgName: i.orgName
        }
    });
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

    const configuration = yaml.load(Buffer.from(contentData.content, 'base64').toString()) as AppConfig;

    return configuration;
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
        catch{
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

    public async AddTeamMember(team: GitHubTeamName, id: GitHubId): Response<unknown> {
        const safeTeam = MakeTeamNameSafe(team);

        await this.gitHubClient.rest.teams.addOrUpdateMembershipForUserInOrg({
            org: this.orgName,
            team_slug: safeTeam,
            username: id
        })

        return {
            successful: true,
            // TODO: make this type better to avoid nulls...
            data: null
        }
    }

    public async CreateTeam(team: GitHubTeamName, description:string): Response<unknown> {
        await this.gitHubClient.rest.teams.create({
            name: team,
            org: this.orgName,
            description,
            privacy:"closed"
        })

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
                successful:true,
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
        const safeTeam = MakeTeamNameSafe(team);

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

    public async RemoveTeamMemberAsync(team: GitHubTeamName, user: GitHubId): Response<unknown> {
        const safeTeam = MakeTeamNameSafe(team);

        await this.gitHubClient.rest.teams.removeMembershipForUserInOrg({
            team_slug: safeTeam,
            org: this.orgName,
            username: user
        })

        return {
            successful: true,
            // TODO: make this type better to avoid nulls...
            data: null
        }
    }

    public async UpdateTeamDetails(team: GitHubTeamName, description: string): Response<unknown> {
        const safeTeam = MakeTeamNameSafe(team);

        await this.gitHubClient.rest.teams.updateInOrg({
            org: this.orgName,
            privacy: "closed",
            team_slug: safeTeam,
            description: description            
        })

        return {
            successful: true,
            // TODO: make this type better to avoid nulls...
            data: null
        }
    }

    public async AddSecurityManagerTeam(team: GitHubTeamName) {
        const safeTeam = MakeTeamNameSafe(team);

        await this.gitHubClient.rest.orgs.addSecurityManagerTeam({
            org: this.orgName,
            team_slug: safeTeam
        })
    }

    public async GetConfigurationForInstallation(): Response<OrgConfiguration> {
        // TODO: this function doesn't really belong on this class...
        // i.e., it doesn't fit with a "GitHub Facade"
        const getContentRequest = {
            owner: this.orgName,
            repo: ".github",
            path: ""
        };

        let filesResponse : AsyncReturnType<typeof this.gitHubClient.rest.repos.getContent>;

        try{
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

        const configuration = yaml.load(Buffer.from(contentData.content, 'base64').toString()) as OrgConfiguration;

        return {
            successful: true,
            data: configuration
        }
    }
}