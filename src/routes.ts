import { getCurrentRateLimitHandler } from "./handlers/getCurrentRateLimit";
import { getInstalledOrgsHandler } from "./handlers/getInstalledOrgs";

export const routes = {
    getInstalledOrgs: getInstalledOrgsHandler,
    getCurrentRateLimit: getCurrentRateLimitHandler
}