import { getCurrentRateLimitHandler } from "./handlers/getCurrentRateLimit.ts";
import { getInstalledOrgsHandler } from "./handlers/getInstalledOrgs.ts";
import { getSourceTeamHandler } from "./handlers/getSourceTeam.ts";
import { syncAllHandler } from "./handlers/syncAll.ts";
import { syncOrgHandler } from "./handlers/syncOrg.ts";
import { syncSpecificTeamHandler } from "./handlers/syncSpecificTeamHandler.ts";

function notImplementedHandler(c: any, req: any, res: any) {
    return res
        .status(404)
        .json({ status: 501, err: "No handler registered for operation" });
}

export const routes = {
    getInstalledOrgs: getInstalledOrgsHandler,
    getCurrentRateLimit: getCurrentRateLimitHandler,
    syncOrg: syncOrgHandler,
    syncAllOrgs: syncAllHandler,
    notImplemented: notImplementedHandler,
    getSourceTeam: getSourceTeamHandler,
    syncSpecificTeam: syncSpecificTeamHandler
}