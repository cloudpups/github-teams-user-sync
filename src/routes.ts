import { getCurrentRateLimitHandler } from "./handlers/getCurrentRateLimit";
import { getInstalledOrgsHandler } from "./handlers/getInstalledOrgs";
import { getSourceTeamHandler } from "./handlers/getSourceTeam";
import { syncAllHandler } from "./handlers/syncAll";
import { syncOrgHandler } from "./handlers/syncOrg";
import { syncSpecificTeamHandler } from "./handlers/syncSpecificTeamHandler";

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