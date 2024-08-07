import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { OrgModel } from "../types/sync-models";
import { GetClient } from "../services/gitHub";

export async function getInstalledOrgsHandler(
    c: Context,
    _req: Request,
    res: Response
) {        
    const client = GetClient();    

    const installations = await client.GetInstallations();

    console.log(installations);

    return res.status(200).json(installations as OrgModel[]);
}