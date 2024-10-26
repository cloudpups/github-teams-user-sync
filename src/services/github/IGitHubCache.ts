import { GitHubId } from "../gitHubTypes";

export interface IGitHubCache {
    setTeamMembers(orgName: string, teamName: string, members:GitHubId[]): Promise<void>;
    getTeamMembers(orgName: string, teamName: string): Promise<GitHubId[]>;
}