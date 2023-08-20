import { GenericSucceededResponse, InstalledClient, OrgInvite,Response } from "./gitHubTypes";

export interface IGitHubInvitations {
    ListInvites():Response<OrgInvite[]>
}

export function GetInvitationsClient(client:InstalledClient) {
    return new GitHubInvitations(client);
}

class GitHubInvitations implements IGitHubInvitations {
    client:InstalledClient;

    constructor(client:InstalledClient) {
        this.client = client;
    }

    async ListInvites(): Response<OrgInvite[]> {
        const allTeams = await this.client.GetAllTeams();

        if(!allTeams.successful) {
            return {
                successful: false
            }
        }
    
        type AsyncReturnType<T extends (...args: any) => Promise<any>> =
        T extends (...args: any) => Promise<infer R> ? R : any
    
        type responseType = AsyncReturnType<typeof this.client.ListPendingInvitesForTeam>
    
        const allPendingPromises = allTeams.data.map(t => this.client.ListPendingInvitesForTeam(t.Name));
    
        const allPendingInvitesResults = await Promise.allSettled(allPendingPromises);    
        
        const allPendingInvites = allPendingInvitesResults
            .filter(r => r.status == "fulfilled")
            .map(r => (r as any).value as responseType)
            .filter(r => r.successful == true && r.data.length > 0)
            .flatMap(r => (r as GenericSucceededResponse<OrgInvite[]>).data)

        return {
            successful:true,
            data:allPendingInvites
        };
    }
}