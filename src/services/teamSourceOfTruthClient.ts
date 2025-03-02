import { Config } from "../config";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import { Log, LoggerToUse } from "../logging";
import { ICacheClient } from "./CacheClient";

const config = Config()
export interface Entry {
    cn: string,
    userPrincipalName: string
}

export type SearchAllFailed = {
    Succeeded: false,
    Reason: "unknown" | "team_not_found"
}

export type SearchAllSucceeded = {
    Succeeded: true,
    entries: Entry[]
}

export type SearchAllResponse = Promise<SearchAllFailed | SearchAllSucceeded>

export async function SearchAllAsync(groupName: string, cacheClient: ICacheClient): SearchAllResponse {
    const cacheKey = `sot-group:${groupName}`;

    const result = await cacheClient.get(cacheKey);

    if (result) {
        LoggerToUse().ReportEvent({
            Name: "CacheHit",
            properties: {
                "Data": groupName,
                "Operation": "SearchAllAsync",
                "Group": "Ldap"
            }
        })
        return JSON.parse(result) as SearchAllResponse
    }

    // Make API call here
    // TODO: abstract this out so that we can mock this in tests
    // instead of dealing with http calls...
    const actualResult = await ForwardSearch(groupName);

    // Slightly complex for caching logic, but we don't want to cache useless results
    if (actualResult.Succeeded && actualResult.entries.length > 0) {
        try {
            await cacheClient.set(cacheKey, JSON.stringify(actualResult), {
                EX: 600 // Expire after 10 minutes
            });
        }
        catch(e) {
            Log(`Error when caching results for ${groupName}: ${JSON.stringify(e)}`);
        }
    }

    return actualResult;
}

// TODO: do not directly use axios.create from within a function like this
// it will cause a new client to be made per request.
const httpClient = axios.create();
axiosRetry(httpClient, {
    retries: 2,
    retryDelay: (retryCount) => {
        Log(`Retry attempt: ${retryCount}`);
        return retryCount * 2000;
    },
    retryCondition: (error) => {
        if (error && error.response && error.response.status) {
            return error.response.status < 200 || error.response.status > 299;
        }

        return true;
    }
});

async function ForwardSearch(groupName: string): SearchAllResponse {
    Log(`Forwarding request to '${process.env.SOURCE_PROXY}'`);

    const requestUrl = `${process.env.SOURCE_PROXY}/search/${groupName}`;

    Log(`Retrieving group (${groupName}) information from '${requestUrl}'`);
    try {
        const httpResponse = await httpClient.get(requestUrl);
        Log(`Results for ${groupName}: ${JSON.stringify(httpResponse.data)}`);      

        if (httpResponse.status < 200 || httpResponse.status > 299) {
            return {
                Succeeded: false,
                Reason: "unknown"
            }
        }

        const response = httpResponse.data as SuccessResponse;

        return {
            Succeeded: true,
            entries: response.users.map(u => {
                return {
                    cn: u.username,
                    userPrincipalName: u.email
                }
            })
        }
    }
    catch (e) {
        Log(`Error when retrieving results for ${groupName}: ${e}`);

        if (e instanceof (AxiosError)) {
            const axiosError = e as AxiosError;
            if (axiosError.response?.status == 404) {
                return {
                    Succeeded: false,
                    Reason: "team_not_found"
                }
            }
        }
    }

    return {
        Succeeded: false,
        Reason: "unknown"
    }
}

export interface User {
    username: string
    email: string
}

export interface SuccessResponse {
    users: User[]
}

export interface FailedResponse {
    Message: string
}

export type SearchResponse = SuccessResponse | FailedResponse;