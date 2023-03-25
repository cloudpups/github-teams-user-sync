import dotenv from "dotenv";

dotenv.config();

export function Config() {
    // TODO: eventually this will need to support the listing of multiple teams from env...
    const securityManagerTeams = process.env.APP_OPTIONS_SecurityManagerTeam ? [process.env.APP_OPTIONS_SecurityManagerTeam] : []

    const config = {
        GitHub: {
            AppId: Number.parseInt(process.env.GitHubApp__AppId!),
            PrivateKey: process.env.GitHubApp__PrivateKey!
        },
        LDAP: {
            User:process.env.LDAP_USER!,
            Password:process.env.LDAP_PASSWORD!,
            Server: process.env.LDAP_SERVER!,
            GroupBaseDN: process.env.LDAP_GROUP_BASE_DN!
        },
        AppOptions: {
            AppConfigRepo: process.env.APP_OPTIONS_AppConfigRepo!,
            AppConfigOrg: process.env.APP_OPTIONS_AppConfigOrg!
            // GitHubIdAppend: process.env.APP_OPTIONS_GitHubIdAppend!,
            // SecurityManagerTeams: securityManagerTeams
        }
    }

    return config;
}