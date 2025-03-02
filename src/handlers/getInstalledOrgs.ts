import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { OrgModel } from "../types/sync-models";
import { GetClient } from "../services/gitHub";
import { CacheClientService } from "../app";

export async function getInstalledOrgsHandler(
    c: Context,
    _req: Request,
    res: Response
) {        
    const client = GetClient(CacheClientService);    

    const installations = await client.GetInstallations();

    console.log(installations);

    return res.status(200).json(installations as OrgModel[]);
}