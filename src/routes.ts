import { getCurrentRateLimitHandler } from "./handlers/getCurrentRateLimit";
import { getInstalledOrgsHandler } from "./handlers/getInstalledOrgs";

function notImplementedHandler(c: any, req: any, res: any) {
    return res
        .status(404)
        .json({ status: 501, err: "No handler registered for operation" });
}

export const routes = {
    getInstalledOrgs: getInstalledOrgsHandler,
    getCurrentRateLimit: getCurrentRateLimitHandler,
    syncOrg: notImplementedHandler,
    syncAllOrgs: notImplementedHandler
}