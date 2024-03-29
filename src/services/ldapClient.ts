import { Config } from "../config";
import ldap from "ldapjs";
import ldapEscape from "ldap-escape";
import axios from "axios";
import axiosRetry from "axios-retry";
import { Log, LogError, LoggerToUse } from "../logging";
import { redisClient } from "../app";

const config = Config()

let client: ldap.Client;

if (!process.env.SOURCE_PROXY) {
    client = ldap.createClient({
        url: [config.LDAP.Server]        
    });

    client.bind(config.LDAP.User, config.LDAP.Password, (err) => {
        if (err) {
            console.log("Failed to connect to LDAP Server");
            LogError(JSON.stringify(err) as string);
        }

        console.log("Connected to LDAP Server");
    });
}
else {
    Log("Group Proxy is set. LDAP will not be configured for this instance.")
}

function SearchAsync(groupName: string): Promise<ldap.SearchCallbackResponse> {
    const component = ldapEscape.filter`${groupName}`;
    const ldapSearchString = `(&(objectCategory=user)(memberOf=CN=${component},CN=Users,${config.LDAP.GroupBaseDN}))`

    const opts: ldap.SearchOptions = {
        filter: ldapSearchString,
        scope: "sub",
        // paged:true
        attributes: ['dn', 'cn', 'userPrincipalName'],
        // paged: {
        //     pageSize: 250,
        //     pagePause: true
        //   }
    };

    return new Promise((resolve, reject) => {
        client.search(config.LDAP.GroupBaseDN, opts, (err, res) => {
            if (err) {
                LogError(`Error searching for ${component}: ${JSON.stringify(err)}`)
                return reject(err);
            }

            return resolve(res);
        });
    })
}

export interface Entry {
    cn: string,
    userPrincipalName: string
}

export type SearchAllFailed = {
    Succeeded: false
}

export type SearchAllSucceeded = {
    Succeeded: true,
    entries: Entry[]    
}

export type SearchAllResponse = Promise<SearchAllFailed | SearchAllSucceeded>

async function SearchAllAsyncNoExceptionHandling(groupName: string): SearchAllResponse {
    // TODO: implement paging somehow!!
    const response = await SearchAsync(groupName);

    const entries: Entry[] = [];    

    type rawEntry = {
        pojo: {
            attributes: {
                type:string,
                values:string[]
            }[]
        }
    }

    return new Promise((resolve, reject) => {
        response.on('searchEntry', (entry: rawEntry) => {
            const attributes = entry.pojo.attributes.map((a) => {
                return [
                    a.type,
                    a.values[0]
                ]
            })
            entries.push(Object.fromEntries(attributes) as Entry);
        });

        type result = {
            status:number
        }

        response.on('end', (result: result) => {
            Log(`Search Ended for Group '${groupName}' with result '${JSON.stringify(result)}'`)

            if (result == null || result == undefined || result.status !== 0) {
                return reject(result.status);
            }

            return resolve({
                entries: entries,                
                Succeeded: true
            });
        });

        response.on('error', (err: unknown) => {
            LogError(`Search Errored for Group '${groupName}': ${JSON.stringify(err)}`);
            return reject();
        });
    });
}

export async function SearchAllAsync(groupName: string): SearchAllResponse {
    const cacheKey = `sot-group:${groupName}`;

    const result = await redisClient.get(cacheKey);

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

    const actualResult = await PrivateSearchAllAsync(groupName);

    // Slightly complex for caching logic, but we don't want to cache useless results
    if (actualResult.Succeeded && actualResult.entries.length > 0) {
        await redisClient.set(cacheKey, JSON.stringify(actualResult), {
            EX: 600 // Expire after 10 minutes
        });
    }

    return actualResult;
}

async function PrivateSearchAllAsync(groupName: string): SearchAllResponse {
    try {
        if (process.env.SOURCE_PROXY) {
            return await ForwardSearch(groupName);
        }

        return await SearchAllAsyncNoExceptionHandling(groupName);
    }
    catch (ex: unknown) {
        Log(JSON.stringify(ex));

        return {
            Succeeded: false
        }
    }
}

// TODO: do not directly use axios.create from within a function like this
// it will cause a new client to be made per request.
const httpClient = axios.create();
axiosRetry(httpClient, {
    retries: 5,
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

    const requestUrl = `${process.env.SOURCE_PROXY}/api/get-source-team?teamName=${groupName}`;

    Log(`Retrieving group (${groupName}) information from '${requestUrl}'`);
    try {
        const result = await httpClient.get(requestUrl);
        Log(`Results for ${groupName}: ${result}`);
        return {
            Succeeded: true,
            ...result.data
        }
    }
    catch (e) {
        Log(`Error when retrieving results for ${groupName}: ${e}`);
    }

    return {
        Succeeded: false
    }
}
