import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { Config } from "../config";

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
    // TODO: implement paging!
    const installationList = await client.rest.apps.listInstallations()

    const mappedOrgs = installationList.data.map(i => {
        return {
            id: i.id,
            orgName: i.account?.login ?? ""
        }
    });

    return mappedOrgs;
}

async function getCurrentRateLimit(installationOctokit: Octokit) {
    const limits = await installationOctokit.rest.rateLimit.get();

    return {
        remaining: limits.data.rate.remaining
    }
}

async function GetOrgClient(installationId: number): Promise<InstalledClient> {
    // TODO: look further into this... it seems like it would be best if 
    // installation client was generated from the original client, and not
    // created fresh.
    const installedOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: Config().GitHub.AppId,
            privateKey: Config().GitHub.PrivateKey,
            installationId
        }
    })    

    return {
        GetCurrentRateLimit: () => getCurrentRateLimit(installedOctokit)
    };
}

export interface Org {
    id: number,
    orgName: string
}

export interface GitHubClient {
    GetInstallations(): Promise<Org[]>
    GetOrgClient(installationId: number): Promise<InstalledClient>
}

export interface InstalledClient {
    GetCurrentRateLimit(): Promise<{remaining:number}>
}

export function GetClient(): GitHubClient {
    const client = authenticatedClient();
    return {
        GetInstallations: () => GetInstallations(client),
        GetOrgClient: (installationId: number) => GetOrgClient(installationId)
    }
}