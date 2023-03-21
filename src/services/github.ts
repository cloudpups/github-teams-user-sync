import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { Config } from "../config";
import { OrgConfiguration } from "../OrgConfiguration";

function authenticatedClient() {
    const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: Config().GitHub.AppId,
            privateKey: Config().GitHub.PrivateKey,
        }
    })

    return appOctokit;
}

async function GetInstallations(client: Octokit): Promise<Org[]> {
    // TODO: implement paging!
    const installationList = await client.rest.apps.listInstallations()

    const mappedOrgs = installationList.data.map(i => {
        return {
            id: i.id,
            orgName: i.account?.login ?? ""
        }
    });

    return mappedOrgs;
}

async function GetOrgClient(installationId: number): Promise<InstalledClient> {
    // TODO: look further into this... it seems like it would be best if 
    // installation client was generated from the original client, and not
    // created fresh.
    const installedOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: Config().GitHub.AppId,
            privateKey: Config().GitHub.PrivateKey,
            installationId
        }
    })    

    return new InstalledGitHubClient(installedOctokit);
}

export interface Org {
    id: number,
    orgName: string
}

export interface GitHubClient {
    GetInstallations(): Promise<Org[]>
    GetOrgClient(installationId: number): Promise<InstalledClient>    
}

export interface InstalledClient {
    GetCurrentRateLimit(): Promise<{remaining:number}>
    AddOrgMember(id:GitHubId): Response
    IsUserMember(id:GitHubId):Response<boolean>
    GetAllTeams():Response<GitHubTeam>
    AddTeamMember(team:GitHubTeam, id:GitHubUser):Response 
    CreateTeam(team:GitHubTeam):Response
    DoesUserExist(gitHubId:string):Response<GitHubId>
    ListCurrentMembersOfGitHubTeam(team:string):Response<GitHubId[]>
    RemoveTeamMemberAsync(team:string, user:GitHubUser):Response
    UpdateTeamDetails(team:string, description:string): Response
    AddSecurityManagerTeam(team:GitHubTeam):Response
    GetConfigurationForInstallation():Response<OrgConfiguration>
}

export function GetClient(): GitHubClient {
    const client = authenticatedClient();
    return {
        GetInstallations: () => GetInstallations(client),
        GetOrgClient: (installationId: number) => GetOrgClient(installationId)
    }
}

export type GenericSucceededResponse<T> = {
    successful: true,
    data: T
}

export type FailedResponse = {
    successful: false
}

export type Response<T = any> = Promise<GenericSucceededResponse<T>  | FailedResponse>;

export type GitHubId = string;

export type GitHubUser = {
    Name: string,
    Email: string
}

export type GitHubTeam = {
    Id: string,
    Name: string,
    Members: GitHubUser[]
}

class InstalledGitHubClient implements InstalledClient {
    gitHubClient:Octokit;

    constructor(gitHubClient:Octokit) {
        this.gitHubClient = gitHubClient;
    }    

    public async GetCurrentRateLimit(): Promise<{ remaining: number; }> {
        const limits = await this.gitHubClient.rest.rateLimit.get();
    
        return {
            remaining: limits.data.rate.remaining
        }
    }
    public AddOrgMember(id: string): Response<any> {
        throw new Error("Method not implemented.");
    }
    public IsUserMember(id: string): Response<boolean> {
        throw new Error("Method not implemented.");
    }
    public GetAllTeams(): Response<GitHubTeam> {
        throw new Error("Method not implemented.");
    }
    public AddTeamMember(team: GitHubTeam, id: GitHubUser): Response<any> {
        throw new Error("Method not implemented.");
    }
    public CreateTeam(team: GitHubTeam): Response<any> {
        throw new Error("Method not implemented.");
    }
    public DoesUserExist(gitHubId: string): Response<string> {
        throw new Error("Method not implemented.");
    }
    public ListCurrentMembersOfGitHubTeam(team: string): Response<string[]> {
        throw new Error("Method not implemented.");
    }
    public RemoveTeamMemberAsync(team: string, user: GitHubUser): Response<any> {
        throw new Error("Method not implemented.");
    }
    public UpdateTeamDetails(team: string, description: string): Response<any> {
        throw new Error("Method not implemented.");
    }
    public AddSecurityManagerTeam(team: GitHubTeam): Response<any> {
        throw new Error("Method not implemented.");
    }
    public GetConfigurationForInstallation(): Response<OrgConfiguration> {
        throw new Error("Method not implemented.");
    }
}