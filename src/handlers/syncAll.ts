import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { GetClient } from "../services/gitHub";
import { SyncOrg } from "../services/githubSync";

export async function syncAllHandler(
    c: Context,
    _req: Request,
    res: Response
) {
    const start = Date.now();

    const client = GetClient();
    const installations = await client.GetInstallations();
    
    async function syncOrg(installationId:number) {
        const orgClient = await client.GetOrgClient(installationId);
        const appConfig = await client.GetAppConfig();

        return await SyncOrg(orgClient, appConfig)
    }

    console.log(`Syncing the following orgs: ${JSON.stringify(installations)}`)

    const orgSyncPromises = installations.map(i => syncOrg(i.id))

    const results = await Promise.all(orgSyncPromises);

    const end = Date.now();

    const resultObject = {
        orgSyncResults: results,
        timeToCompleteInMilliseconds: end - start
    }

    return res.status(200).json(resultObject);
}