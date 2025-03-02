import { describe, expect, test } from '@jest/globals';
import { IRawInstalledGitHubClient, OrgInvite } from '../../src/services/gitHubTypes';
import { anyString, instance, mock, when, verify, anything } from 'ts-mockito';
import { SyncOrg } from '../../src/services/githubSync';
import { IGitHubInvitations } from '../../src/services/githubInvitations';
import { AppConfig } from '../../src/services/appConfig';
import { InMemoryCacheClient } from '../cacheClientMock';
import { OrgConfig } from '../../src/services/orgConfig';

describe('githubSync -- SyncOrg', () => {
    test('Should execute syncronize steps in expected order', async () => {
        // Arrange
        const orgName = "some_org";

        const securityManagerTeam = {
            Id: 123123,
            Name: "securityManagerTeam",
            DisplayName: "Security Manager Team"
        };
        const teamOne = {
            Name: "some_team_name",
            DisplayName: "SomeName"
        }
        const teamOneMembers = ["1", "2"];
        const teamSlug = `${orgName}_${teamOne.Name}`;

        const config: OrgConfig = new OrgConfig({
            Teams: [

            ],
            GitHubTeamNames: [teamOne.Name],
            OrganizationOwnersGroup: "owners",
            OrganizationMembersGroup: "members",
            AdditionalSecurityManagerGroups: []
        });

        const installedClientMock = mock<IRawInstalledGitHubClient>();
        when(installedClientMock.GetCurrentOrgName()).thenReturn(orgName);
        when(installedClientMock.GetAllTeams()).thenResolve({ successful: true, data: [securityManagerTeam] });
        when(installedClientMock.GetConfigurationForInstallation()).thenResolve({ successful: false, state: "NoConfig" });

        const invitationsClientMock = mock<IGitHubInvitations>();
        when(invitationsClientMock.ListInvites()).thenResolve({ successful: true, data: [] });

        const inMemoryCacheClient = new InMemoryCacheClient();
        const appConfig: AppConfig = {
            Description: { ShortLink: "shortLink" },
            GitHubIdAppend: "githubIdAppend",
            SecurityManagerTeams: [securityManagerTeam.Name],
            TeamsToIgnore: []
        };

        // Act  
        const response = SyncOrg(instance(installedClientMock), appConfig, instance(invitationsClientMock), inMemoryCacheClient);

        // Assert   
        verify(installedClientMock.GetCurrentOrgName()).calledBefore(invitationsClientMock.ListInvites());
        verify(installedClientMock.AddSecurityManagerTeam(anyString())).once();
    });


});

