import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { Config } from "../config";
import { GitHubClient, IInstalledClient, Org } from "./gitHubTypes";
import { AppConfig } from "./appConfig";
import yaml from "js-yaml";
import { throttling } from "@octokit/plugin-throttling";
import { Log, LoggerToUse } from "../logging";
import { GitHubClientCache } from "./gitHubCache";
import { redisClient } from "../app";
import { InstalledGitHubClient } from "./installedGitHubClient";
import { RedisCacheClient } from "../integrations/redisCacheClient";

const config = Config();

async function GetOrgClient(installationId: number): Promise<IInstalledClient> {
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
    const redisCacheClient = new RedisCacheClient(redisClient);

    if (Config().AppOptions.RedisHost) {
        const cachedClient = new GitHubClientCache(baseClient, redisCacheClient, LoggerToUse());
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
    catch (e) {
        console.log(e);
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