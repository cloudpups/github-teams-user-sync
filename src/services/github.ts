import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { Config } from "../config";
import { GitHubClient, InstalledClient, Org } from "./gitHubTypes";
import { GetOrgClient } from "./installedGitHubClient";

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
            orgName: i.account?.login ?? ""
        }
    });

    return mappedOrgs;
}


export function GetClient(): GitHubClient {
    const client = authenticatedClient();
    return {
        GetInstallations: () => GetInstallations(client),
        GetOrgClient: (installationId: number) => GetOrgClient(installationId)
    }
}