interface IGitHubEtagCache {
    setTeamMemberEtag(orgName: string, teamName: string, etag: string): Promise<void>;
    getTeamMemberEtag(orgName: string, teamName: string): Promise<string>;
}