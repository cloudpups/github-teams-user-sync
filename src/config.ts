import dotenv from "dotenv";

dotenv.config();

export function Config() {
    const config = {
        GitHub: {
            AppId: Number.parseInt(process.env.GitHubApp__AppId!),
            PrivateKey: process.env.GitHubApp__PrivateKey!
        },
        OAUTH: {
            ClientId: process.env.OAUTH_CLIENT_ID!,
            ClientSecret: process.env.OAUTH_CLIENT_SECRET!,
            Authority: process.env.OAUTH_AUTHORITY!
        },
        LDAP: {
            User:process.env.LDAP_USER!,
            Password:process.env.LDAP_PASSWORD!,
            Server: process.env.LDAP_SERVER!,
            GroupBaseDN: process.env.LDAP_GROUP_BASE_DN!
        }
    }

    return config;
}