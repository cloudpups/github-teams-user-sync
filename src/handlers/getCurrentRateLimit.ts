import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { GetClient } from "../services/github";
import { Limits } from "../types/sync-models";

export async function getCurrentRateLimitHandler(
    c: Context,
    _req: Request,
    res: Response
) {                
    const orgId = c.request.params.orgId as unknown as number;

    const client = GetClient();
    const orgClient = await client.GetOrgClient(orgId);

    const limits = await orgClient.GetCurrentRateLimit();

    return res.status(200).json(limits as Limits);
}