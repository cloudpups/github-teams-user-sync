import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { GetClient } from "../services/gitHub";
import { SyncOrg, SyncTeam } from "../services/githubSync";
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

export async function syncSpecificTeamHandler(
    c: Context,
    _req: Request,
    res: Response
) {    
    const orgId = c.request.query.orgId! as unknown as number;
    const teamName = c.request.query.teamName! as unknown as string;

    const client = GetClient();
    const orgClient = await client.GetOrgClient(orgId);
    const appConfig = await client.GetAppConfig();

    // const existingOrgMembers = await orgClient.GetOrgMembers();

    // if(!existingOrgMembers.successful) {
    //     return res.status(500).json("Unable to fetch org members");    
    // }

    const response = await SyncTeam(teamName, orgClient, appConfig);

    return res.status(200).json(response);
}