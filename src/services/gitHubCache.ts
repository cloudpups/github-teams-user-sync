import { GitHubTeamId, InstalledClient, OrgConfiguration, Response } from "./gitHubTypes";

export class GitHubClientCache implements InstalledClient {
    client: InstalledClient;
    
    constructor(client: InstalledClient) {
        this.client = client;
    }

    GetCurrentOrgName(): string {
        return this.client.GetCurrentOrgName();
    }
    GetCurrentRateLimit(): Promise<{ remaining: number; }> {
        return this.client.GetCurrentRateLimit();
    }
    AddOrgMember(id: string): Response<unknown> {
        return this.client.AddOrgMember(id);
    }
    IsUserMember(id: string): Response<boolean> {
        return this.client.IsUserMember(id);
    }
    GetAllTeams(): Response<GitHubTeamId[]> {
        return this.client.GetAllTeams();
    }
    AddTeamMember(team: string, id: string): Response<unknown> {
        return this.client.AddTeamMember(team, id);
    }
    CreateTeam(teamName: string, description: string): Response<unknown> {
        return this.client.CreateTeam(teamName, description);
    }
    DoesUserExist(gitHubId: string): Response<string> {
        return this.client.DoesUserExist(gitHubId);
    }
    ListCurrentMembersOfGitHubTeam(team: string): Response<string[]> {
        return this.client.ListCurrentMembersOfGitHubTeam(team);
    }
    RemoveTeamMemberAsync(team: string, user: string): Response<unknown> {
        return this.client.RemoveTeamMemberAsync(team, user);
    }
    UpdateTeamDetails(team: string, description: string): Response<unknown> {
        return this.client.UpdateTeamDetails(team, description);
    }
    AddSecurityManagerTeam(team: string): Promise<unknown> {
        return this.client.AddSecurityManagerTeam(team);
    }
    GetConfigurationForInstallation(): Response<OrgConfiguration> {
        return this.client.GetConfigurationForInstallation();
    }
    GetOrgMembers(): Response<string[]> {
        return this.client.GetOrgMembers();
    }
}