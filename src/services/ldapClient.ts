import { Config } from "../config";
import ldap from "ldapjs";

const config = Config()

const client = ldap.createClient({
    url: [config.LDAP.Server]
});

client.bind(config.LDAP.User, config.LDAP.Password, (err) => {
    console.log(err);
});

function SearchAsync(groupName: string): Promise<any> {
    const ldapSearchString = `(&(objectCategory=user)(memberOf=CN=${groupName},CN=Users,${config.LDAP.GroupBaseDN}))`

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

export async function SearchAllAsync(groupName: string): SearchAllResponse {
    // TODO: implement paging somehow!!
    const response = await SearchAsync(groupName);
    const entries: Entry[] = [];
    let referrals: any[] = [];

    return new Promise((resolve, reject) => {
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
        // response.on('error', (error:any) => {
        //     if (error.name === 'SizeLimitExceededError' &&
        //         options.sizeLimit && options.sizeLimit > 0) {
        //         return resolve(entries);
        //     } else {
        //         return reject(error);
        //     }
        // })
        response.on('end', (result: any) => {
            if (result.status !== 0) {
                return reject(result.status);
            }

            return resolve({
                entries: entries,
                referrals: referrals
            });
        });
    });
}


            // res.on('searchRequest', (searchRequest) => {
            //     console.log('searchRequest: ', searchRequest.messageId);
            // });
            // res.on('searchEntry', (entry: any) => {
            //     console.log('entry: ' + JSON.stringify(entry.pojo));
            //     fs.writeFileSync("./what.json", JSON.stringify(entry.pojo))
            // });
            // res.on('searchReference', (referral) => {
            //     console.log('referral: ' + referral.uris.join());
            // });
            // res.on('error', (err) => {
            //     console.error('error: ' + err.message);
            // });
            // res.on('end', (result: any) => {
            //     console.log('status: ' + result.status);
            // });