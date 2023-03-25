import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { Limits } from "../types/sync-models";
import { GetClient } from "../services/gitHub";

export async function getCurrentRateLimitHandler(
    c: Context,
    _req: Request,
    res: Response
) {                
    const installationId = c.request.params.installationId as unknown as number;    

    const client = GetClient();    
    const orgClient = await client.GetOrgClient(installationId);    
    const limits = await orgClient.GetCurrentRateLimit();

    return res.status(200).json(limits as Limits);
}