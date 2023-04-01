import { AppConfig } from "./appConfig"

export interface Org {
    id: number,
    orgName: string
}

export interface GitHubClient {
    GetInstallations(): Promise<Org[]>
    GetOrgClient(installationId: number): Promise<InstalledClient>
    GetAppConfig(): Promise<AppConfig>
}

export interface InstalledClient {
    GetCurrentOrgName(): string
    GetCurrentRateLimit(): Promise<{ remaining: number }>
    AddOrgMember(id: GitHubId): Response
    IsUserMember(id: GitHubId): Response<boolean>
    GetAllTeams(): Response<GitHubTeamId[]>
    AddTeamMember(team: GitHubTeamName, id: GitHubId): Response
    CreateTeam(teamName: GitHubTeamName, description:string): Response
    DoesUserExist(gitHubId: string): Response<GitHubId>
    ListCurrentMembersOfGitHubTeam(team: GitHubTeamName): Response<GitHubId[]>
    RemoveTeamMemberAsync(team: GitHubTeamName, user: GitHubId): Response
    UpdateTeamDetails(team: GitHubTeamName, description: string): Response
    AddSecurityManagerTeam(team: GitHubTeamName): Promise<unknown>
    GetConfigurationForInstallation(): Response<OrgConfiguration>    
    GetOrgMembers(): Response<GitHubId[]>
}


export type GenericSucceededResponse<T> = {
    successful: true,
    data: T
}

export type FailedResponse = {
    successful: false
}

export type Response<T = unknown> = Promise<GenericSucceededResponse<T> | FailedResponse>;

export type GitHubId = string;

export type GitHubUser = {
    Name: string,
    Email: string
}

export type GitHubTeamId = {
    Id: number,
    Name: string    
}

export type GitHubTeam = {
    Id: number,
    Name: string,
    Members: GitHubUser[]
}

export type GitHubTeamName = string;

export type OrgConfiguration = {
    GitHubTeamNames?: string[]
    OrganizationMembersGroup?: string
}