import { describe, expect, test } from '@jest/globals';
import { IRawInstalledGitHubClient, OrgInvite } from '../../src/services/gitHubTypes';
import { anyString, instance, mock, when, verify, anything } from 'ts-mockito';
import { GitHubSyncer } from '../../src/services/githubSync';
import { IGitHubInvitations } from '../../src/services/githubInvitations';
import { AppConfig } from '../../src/services/appConfig';
import { OrgConfig } from '../../src/services/orgConfig';
import { ISourceOfTruthClient } from '../../src/services/teamSourceOfTruthClient';
import { GihubSyncOrchestrator } from '../../src/services/gihubSyncOrchestrator';

describe('GitHubSyncer -- SyncOrg', () => {
    test('Should execute syncronize steps in expected order', async () => {
        // Arrange
        const orgName = "some_org";

        const user1 = {
            userPrincipalName: "user1",            
            cn: "1"
        }

        const securityManagerTeam = {
            Id: 123123,
            Name: "securityManagerTeam",
            DisplayName: "Security Manager Team"
        };

        const installedClientMock = mock<IRawInstalledGitHubClient>();
        when(installedClientMock.GetCurrentOrgName()).thenReturn(orgName);
        when(installedClientMock.GetAllTeams()).thenResolve({ successful: true, data: [securityManagerTeam] });
        when(installedClientMock.GetConfigurationForInstallation()).thenResolve({ successful: false, state: "NoConfig" });
        when(installedClientMock.DoesUserExist(user1.userPrincipalName)).thenResolve({ successful: true, data: user1.userPrincipalName });
        when(installedClientMock.IsUserMember(user1.userPrincipalName)).thenResolve({ successful: true, data: true });           

        const invitationsClientMock = mock<IGitHubInvitations>();
        when(invitationsClientMock.ListInvites()).thenResolve({ successful: true, data: [] });

        const sourceOfTruthClientMock = mock<ISourceOfTruthClient>();
        when(sourceOfTruthClientMock.SearchAllAsync(securityManagerTeam.Name)).thenResolve({ Succeeded: true, entries:[user1] });
        
        const appConfig: AppConfig = {
            Description: { ShortLink: "shortLink" },
            GitHubIdAppend: "",
            SecurityManagerTeams: [securityManagerTeam.Name],
            TeamsToIgnore: []
        };

        const config: OrgConfig = new OrgConfig({
            Teams: [
            ],
            GitHubTeamNames: [],
            OrganizationOwnersGroup: "",
            OrganizationMembersGroup: "",
            AdditionalSecurityManagerGroups: []
        });

        const syncerMock = mock<GitHubSyncer>();
        when(syncerMock.AppConfig).thenReturn(appConfig);
        when(syncerMock.InstalledGitHubClient).thenReturn(instance(installedClientMock));
        when(syncerMock.InvitationsClient).thenReturn(instance(invitationsClientMock));       
        when(syncerMock.Initialize()).thenResolve({ successful: true, data:config }); 
        when(syncerMock.SyncSecurityManagers()).thenResolve({Success: true, SyncedSecurityManagerTeams: [securityManagerTeam.Name]});        
        
        const sut = new GihubSyncOrchestrator(instance(syncerMock)); 

        // Act  
        const response = sut.SyncOrg();

        // Assert   
        verify(syncerMock.Initialize()).calledBefore(syncerMock.SyncSecurityManagers());
        verify(syncerMock.SyncSecurityManagers()).once();
    });
});

