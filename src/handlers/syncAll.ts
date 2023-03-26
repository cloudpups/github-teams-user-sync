import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { GetClient } from "../services/gitHub";
import { SyncOrg } from "../services/githubSync";

export async function syncAllHandler(
    c: Context,
    _req: Request,
    res: Response
) {
    const client = GetClient();
    const installations = await client.GetInstallations();
    
    async function syncOrg(installationId:number) {
        const orgClient = await client.GetOrgClient(installationId);
        const appConfig = await client.GetAppConfig();

        await SyncOrg(orgClient, appConfig)
    }

    console.log(`Syncing the following orgs: ${JSON.stringify(installations)}`)

    const orgSyncPromises = installations.map(i => syncOrg(i.id))

    await Promise.all(orgSyncPromises);

    return res.status(200).json("Done!");
}