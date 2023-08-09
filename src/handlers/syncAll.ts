import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { GetClient } from "../services/gitHub";
import { SyncOrg } from "../services/githubSync";
import { GitHubClient } from "../services/gitHubTypes";
import axios from 'axios';
import { Log } from "../logging";

async function syncOrgLocal(installationId: number, client: GitHubClient) {
    const orgClient = await client.GetOrgClient(installationId);
    const appConfig = await client.GetAppConfig();

    return await SyncOrg(orgClient, appConfig)
}

export async function syncAllHandler(
    c: Context,
    _req: Request,
    res: Response
) {
    const start = Date.now();

    const client = GetClient();
    const installations = await client.GetInstallations();

    Log(`Syncing the following orgs: ${JSON.stringify(installations)}`)
    
    if (process.env.GITHUB_PROXY) {
        // TODO: clean this up... Such forwarding logic should not be included in 
        // "handlers"
        Log(`Forwarding request to '${process.env.GITHUB_PROXY}'`);
        const requestUrl = `${process.env.GITHUB_PROXY}/api/sync/SynchronizeOrg?installationId=`
        const orgSyncPromises = installations.map(i => axios.post(`${requestUrl}${i}`));

        const results = await Promise.allSettled(orgSyncPromises);

        const end = Date.now();

        const resultObject = {
            orgSyncResults: results,
            timeToCompleteInMilliseconds: end - start
        }

        return res.status(200).json(resultObject);
    }
    else {
        const orgSyncPromises = installations.map(i => syncOrgLocal(i.id, client))
        const results = await Promise.allSettled(orgSyncPromises);

        const end = Date.now();

        const resultObject = {
            orgSyncResults: results,
            timeToCompleteInMilliseconds: end - start
        }

        return res.status(200).json(resultObject);
    }

    return res.status(500).json("An error occurred");
}
