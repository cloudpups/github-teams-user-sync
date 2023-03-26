import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { GetClient } from "../services/gitHub";
import { SyncOrg } from "../services/githubSync";
import { AsyncReturnType } from "../utility";

export async function syncOrgHandler(
    c: Context,
    _req: Request,
    res: Response
) {
    const potentialIds = c.request.query.installationId;
    const installationIds = potentialIds instanceof Array ? potentialIds : [potentialIds];
    const distinctIds = new Set(installationIds.map(i => {
        return Number.parseInt(i)
    }));

    const client = GetClient();

    const syncOrgResponses : AsyncReturnType<typeof SyncOrg>[] = [];

    for (let i of distinctIds) {
        const orgClient = await client.GetOrgClient(i);
        const appConfig = await client.GetAppConfig();

        syncOrgResponses.push(await SyncOrg(orgClient, appConfig));
    }

    return res.status(200).json(syncOrgResponses);
}