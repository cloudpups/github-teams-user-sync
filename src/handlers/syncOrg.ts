import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { GetClient } from "../services/gitHub";
import { SyncOrg } from "../services/githubSync";
import { AsyncReturnType } from "../utility";
import axios from 'axios';

async function forwardToProxy(installationId: number) {    
    console.log(`Forwarding request to '${process.env.GITHUB_PROXY}'`);
    const requestUrl = `${process.env.GITHUB_PROXY}/api/sync/SynchronizeOrg?installationId=${installationId}`    

    const result = await axios.post(requestUrl);

    if(result.status >= 200 && result.status < 300) {
        return result.data;
    }

    return {
        status: "failed",
        installationId: installationId
    }
}

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

    if (process.env.GITHUB_PROXY) {        
        const orgSyncPromises = Array.from(distinctIds).map(forwardToProxy);

        const results = await Promise.allSettled(orgSyncPromises);
        
        return res.status(200).json(results);
    }

    const client = GetClient();

    const syncOrgResponses : AsyncReturnType<typeof SyncOrg>[] = [];

    for (let i of distinctIds) {
        const orgClient = await client.GetOrgClient(i);
        const appConfig = await client.GetAppConfig();

        syncOrgResponses.push(await SyncOrg(orgClient, appConfig));
    }

    return res.status(200).json(syncOrgResponses);
}