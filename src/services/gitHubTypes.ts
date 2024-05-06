import { AppConfig } from "./appConfig"
import { GitHubTeamName, OrgConfig } from "./orgConfig"

export interface Org {
    id: number,
    orgName: string
}

export interface GitHubClient {
    GetInstallations(): Promise<Org[]>
    GetOrgClient(installationId: number): Promise<InstalledClient>
    GetAppConfig(): Promise<AppConfig>
}

export type OrgRoles = "admin" | "member";

export type OrgInvite = {
    InviteId: number,
    GitHubUser: string
}

export interface InstalledClient {
    GetCurrentOrgName(): string
    GetCurrentRateLimit(): Promise<{ remaining: number }>
    AddOrgMember(id: GitHubId): Response
    IsUserMember(id: GitHubId): Response<boolean>
    GetAllTeams(): Response<GitHubTeamId[]>
    AddTeamMember(team: GitHubTeamName, id: GitHubId): AddMemberResponse
    CreateTeam(teamName: GitHubTeamName, description:string): Response
    DoesUserExist(gitHubId: string): Response<GitHubId>
    ListCurrentMembersOfGitHubTeam(team: GitHubTeamName): Response<GitHubId[]>
    RemoveTeamMemberAsync(team: GitHubTeamName, user: GitHubId): RemoveMemberResponse
    UpdateTeamDetails(team: GitHubTeamName, description: string): Response
    AddSecurityManagerTeam(team: GitHubTeamName): Promise<unknown>
    GetConfigurationForInstallation(): Response<OrgConfig>    
    GetOrgMembers(): Response<GitHubId[]>
    SetOrgRole(id: GitHubId, role: OrgRoles): Response
    GetPendingOrgInvites():Response<OrgInvite[]>
    CancelOrgInvite(invite:OrgInvite): Response    
    ListPendingInvitesForTeam(teamName: GitHubTeamName):Response<OrgInvite[]>
    AddTeamsToCopilotSubscription(teamNames: GitHubTeamName[]):Response<CopilotAddResponse[]>
}

export type CopilotAddResponse = CopilotAddSucceeded | CopilotAddFailed

export type CopilotAddSucceeded = {
    successful: true,
    team: GitHubTeamName
}

export type CopilotAddFailed = {
    successful: false,
    team: GitHubTeamName
}

export type AddMemberResponse = Promise<AddMemberSucceeded | AddMemberFailed>

export type AddMemberSucceeded = {
    successful: true,
    user: GitHubId,
    team: GitHubTeamName
}

export type AddMemberFailed = {
    successful: false,
    user: GitHubId,
    team: GitHubTeamName,
    message: string
}

export type RemoveMemberResponse = Promise<RemoveMemberSucceeded | RemoveMemberFailed>

export type RemoveMemberSucceeded = {
    successful: true,
    user: GitHubId,
    team: GitHubTeamName
}

export type RemoveMemberFailed = {
    successful: false,
    user: GitHubId,
    team: GitHubTeamName,
    message: string
}



export type GenericSucceededResponse<T> = {
    successful: true,
    data: T
}

export type FailedResponse = {
    successful: false,
    message?:string
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
