import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { GetClient } from "../services/gitHub";
import { SyncCopilotTeams, SyncOrg } from "../services/githubSync";
import { AsyncReturnType } from "../utility";
import axios from 'axios';
import { Log } from "../logging";
import { GetInvitationsClient } from "../services/githubInvitations";
import { globalPublisher, redisClient } from "../app";

async function forwardToProxy(orgId: number) {    
    Log(`Forwarding request to '${process.env.GITHUB_PROXY}'`);
    const requestUrl = `${process.env.GITHUB_PROXY}/api/sync/SynchronizeCopilotTeams?orgId=${orgId}`    

    const result = await axios.post(requestUrl);

    if(result.status >= 200 && result.status < 300) {
        return result.data;
    }

    return {
        status: "failed",
        installationId: orgId
    }
}

export async function syncCopilotTeamsHandler(
    c: Context,
    _req: Request,
    res: Response
) {    
    const orgId = Number.parseInt(c.request.query.orgId as string);    

    if (process.env.GITHUB_PROXY) {                
        const result = await forwardToProxy(orgId);
        
        return res.status(200).json(result);
    }

    const client = GetClient();

    const orgClient = await client.GetOrgClient(orgId);
    const appConfig = await client.GetAppConfig();

    const result = await SyncCopilotTeams(orgClient, appConfig);

    return res.status(200).json(result);
}