import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { OrgModel } from "../types/sync-models";

export async function getInstalledOrgsHandler(
    c: Context,
    _req: Request,
    res: Response
) {    
    console.log("Hello");
    
    const sampleOrgResponse : OrgModel[] = [
        {id:1, orgName:"Test"}
    ]

    return res.status(200).json(sampleOrgResponse);
}