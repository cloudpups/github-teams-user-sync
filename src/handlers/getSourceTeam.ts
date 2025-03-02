import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { SearchAllAsync } from "../services/teamSourceOfTruthClient";
import { Log } from "../logging";
import { CacheClientService } from "../app";

export async function getSourceTeamHandler(
    c: Context,
    _req: Request,
    res: Response
) {
    const teamName = _req.query.teamName as string;

    Log(`Searching SoT for ${teamName}`)

    const result = await SearchAllAsync(teamName, CacheClientService)

    if (result.Succeeded) {
        Log(`Found in SoT:  ${JSON.stringify(result)}`)
        return res.status(200).json(result);
    }

    return res.status(500).json(result)
}