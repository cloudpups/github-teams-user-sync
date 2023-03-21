import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { Config } from "../config";

function authenticatedClient() {
    const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {   appId: Config().GitHub.AppId,
          privateKey: Config().GitHub.PrivateKey, }
      })
      

    return appOctokit;
}

async function GetInstallations(client:Octokit) : Promise<Org[]> {
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

export interface Org {
    id:number,
    orgName:string
}

export interface GitHubClient {
    GetInstallations():Promise<Org[]>
}

export function GetClient() : GitHubClient {
    const client = authenticatedClient();
    return {
        GetInstallations: () => GetInstallations(client)
    }
}