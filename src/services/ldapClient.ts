import { Config } from "../config";
import ldap from "ldapjs";
import ldapEscape from "ldap-escape";
import axios from "axios";
import axiosRetry from "axios-retry";

const config = Config()

let client: ldap.Client;

if(!process.env.SOURCE_PROXY) {
    client = ldap.createClient({
        url: [config.LDAP.Server]
    });
    
    client.bind(config.LDAP.User, config.LDAP.Password, (err) => {
        console.log(err);
    });
}
else {
    console.log("Group Proxy is set. LDAP will not be configured for this instance.")
}

function SearchAsync(groupName: string): Promise<any> {
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

export type SearchAllResponse = Promise<{
    entries: Entry[],
    referrals: any[]
}>

async function SearchAllAsyncNoExceptionHandling(groupName: string): SearchAllResponse {
    // TODO: implement paging somehow!!
    const response = await SearchAsync(groupName);

    const entries: Entry[] = [];
    let referrals: any[] = [];

    return new Promise((resolve, reject) => {
        // res.on('searchRequest', (searchRequest) => {
        //     console.log('searchRequest: ', searchRequest.messageId);
        // });

        response.on('searchEntry', (entry: any) => {
            const attributes = entry.pojo.attributes.map((a: any) => {
                return [
                    a.type,
                    a.values[0]
                ]
            })
            entries.push(Object.fromEntries(attributes) as Entry);
        });

        response.on('searchReference', (referral: any) => {
            referrals = referrals.concat(referral.uris);
        });

        response.on('end', (result: any) => {
            if (result.status !== 0) {
                return reject(result.status);
            }

            return resolve({
                entries: entries,
                referrals: referrals
            });
        });

        response.on('error', (err: any) => {
            console.error('error: ' + err.message);
            return reject();
        });

        // response.on('error', (error:any) => {
        //     if (error.name === 'SizeLimitExceededError' &&
        //         options.sizeLimit && options.sizeLimit > 0) {
        //         return resolve(entries);
        //     } else {
        //         return reject(error);
        //     }
        // })
    });
}         

export async function SearchAllAsync(groupName: string): SearchAllResponse {
    try {
        if(process.env.SOURCE_PROXY) {
            return await ForwardSearch(groupName);
        }
    
        return await SearchAllAsyncNoExceptionHandling(groupName);
    }
    catch {
        return {
            entries: [] as Entry[],
            referrals: []
        }
    }
}

async function ForwardSearch(groupName: string) {
    console.log(`Forwarding request to '${process.env.SOURCE_PROXY}'`);
    
    // cb is for cache busting.
    const requestUrl = `${process.env.SOURCE_PROXY}/api/get-source-team?teamName=${groupName}&cb=${Date.now()}`;

    console.log(`Retrieving group (${groupName}) information from '${requestUrl}'`);
    try{
        // TODO: do not directly use axios.create from within a function like this
        // it will cause a new client to be made per request.
        const client = axios.create();
        axiosRetry(client, { retries: 5 });

        const result = await client.get(requestUrl);
        console.log(`Results for ${groupName}: ${result}`);
        return result.data as SearchAllResponse;
    }    
    catch(e) {        
        console.log(`Error when retrieving results for ${groupName}: ${e}`);
    }
    
    return {
        entries: [] as Entry[],
        referrals: []
    }
}
