import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { GetClient } from "../services/gitHub";
import { GitHubSyncer } from "../services/githubSync";
import axios from 'axios';
import { Log } from "../logging";
import { GetInvitationsClient } from "../services/githubInvitations";
import { CacheClientService } from "../app";

async function forwardToProxy(installationId: number) {    
    Log(`Forwarding request to '${process.env.GITHUB_PROXY}'`);
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
    const dryRun = c.request.query.dryRun as unknown as boolean ?? true;

    const client = GetClient(CacheClientService);
    const orgClient = await client.GetOrgClient(orgId);
    const appConfig = await client.GetAppConfig();

    const invitationsClient = GetInvitationsClient(orgClient);

    const invitesResponse = await invitationsClient.ListInvites();

    if(!invitesResponse.successful) {
        return res.status(500).json("Unable to list existing invites");    
    }

    const invites = invitesResponse.data;

    const orgConfig = await orgClient.GetConfigurationForInstallation();

    if(!orgConfig.successful) {
        return res.status(500).json({
            Message: "Unable to fetch organization configuration."
        })
    }

    const sourceTeamMap = orgConfig.data.DisplayNameToSourceMap;

    const syncer = new GitHubSyncer(orgClient, appConfig, invitationsClient, CacheClientService);

    const response = await syncer.SyncTeam(teamName, orgClient, appConfig, invites, sourceTeamMap, CacheClientService, dryRun);

    return res.status(200).json(response);
}