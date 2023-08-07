import { Context } from "openapi-backend";
import type { Request, Response } from "express";
import { SearchAllAsync } from "../services/ldapClient";

export async function getSourceTeamHandler(
    c: Context,
    _req: Request,
    res: Response
) {    
    const teamName = _req.query.teamName as string;

    const result = await SearchAllAsync(teamName)

    return res.status(200).json(result);
}