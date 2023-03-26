import { getCurrentRateLimitHandler } from "./handlers/getCurrentRateLimit";
import { getInstalledOrgsHandler } from "./handlers/getInstalledOrgs";
import { syncAllHandler } from "./handlers/syncAll";
import { syncOrgHandler } from "./handlers/syncOrg";

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
    notImplemented: notImplementedHandler
}