import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import dotenv from 'dotenv';
import { InstalledGitHubClient } from '../../src/services/installedGitHubClient';

describe('InstalledGitHubClient Class', () => {
  let appConfig: {
    installationId: number,
    appId: number,
    privateKey: string
  };

  let testConfig: {
    team1: {
      name: string
      member: string
    },
    team2: {
      name: string
      member: string
    },
    orgName: string
  }

  let client: Octokit;

  beforeAll(async () => {
    dotenv.config({
      // See `tests/integration/README.md` for more information
      path: "test/integration/.env.sync-bot.tests"
    })

    appConfig = {
      appId: process.env.GitHubApp__AppId! as unknown as number,
      installationId: process.env.Tests__InstallationId! as unknown as number,
      privateKey: process.env.GitHubApp__PrivateKey!
    }

    // TODO: create teams and assign membership at test start
    testConfig = {
      team1: {
        name: process.env.Tests_ToMake_Team1_Name!,
        member: process.env.Tests_ToMake_Team1_Member!
      },
      team2: {
        name: process.env.Tests_ToMake_Team2_Name!,
        member: process.env.Tests_ToMake_Team2_Member!
      },
      orgName: process.env.Tests__OrgName!
    }

    client = new Octokit({
      authStrategy: createAppAuth,
      auth: appConfig
    });

    // Setup test org
    try {
      const team1 = await client.rest.teams.create({
        name: testConfig.team1.name,
        org: testConfig.orgName,
        privacy: "closed"
      });

      await client.rest.teams.addOrUpdateMembershipForUserInOrg({
        org: testConfig.orgName,
        team_slug: testConfig.team1.name,
        username: testConfig.team1.member
      });

      await client.rest.teams.create({
        name: testConfig.team2.name,
        org: testConfig.orgName,
        parent_team_id: team1.data.id,
        privacy: "closed"
      });

      await client.rest.teams.addOrUpdateMembershipForUserInOrg({
        org: testConfig.orgName,
        team_slug: testConfig.team2.name,
        username: testConfig.team2.member
      });
    }
    catch (e) {
      console.log(e);
      throw e;
    }

    const timeOutToAllowGitHubCacheToUpdateInMillis = 2000;
    await new Promise((r) => setTimeout(r, timeOutToAllowGitHubCacheToUpdateInMillis));
  }, 10000);

  afterAll(async () => {
    try {
      await client.rest.teams.deleteInOrg({
        org: testConfig.orgName,
        team_slug: testConfig.team2.name
      });

      await client.rest.teams.deleteInOrg({
        org: testConfig.orgName,
        team_slug: testConfig.team1.name
      });      
    }
    catch (e) {
      console.log(e);
      throw e;
    }
  })

  afterAll(async () => {
    try {
      await client.rest.teams.deleteInOrg({
        org: testConfig.orgName,
        team_slug: testConfig.team2.name
      });

      await client.rest.teams.deleteInOrg({
        org: testConfig.orgName,
        team_slug: testConfig.team1.name
      });      
    }
    catch (e) {
      console.log(e);
      throw e;
    }
  })

  test('ListCurrentMembersOfGitHubTeam returns expected team members', async () => {
    // Arrange         
    const installedGitHubClient = new InstalledGitHubClient(client, testConfig.orgName);

    const expectedTeam1 = testConfig.team1.name;
    const expectedUser1 = testConfig.team1.member;
    const expectedTeam2 = testConfig.team2.name;
    const expectedUser2 = testConfig.team2.member;

    // Act
    const response = await installedGitHubClient.ListCurrentMembersOfGitHubTeam(expectedTeam1);
    const response2 = await installedGitHubClient.ListCurrentMembersOfGitHubTeam(expectedTeam2);

    const actualMembers = response.successful ? response.data : [];
    const actualMembers2 = response2.successful ? response2.data : [];

    // Assert     
    // By testing both teams, we can validate that we have solved the "child team members" problem
    // as the `beforeAll` step configures team2 to be a child of team1. For more information, refer 
    // to the following GitHub Issue: https://github.com/cloudpups/github-teams-user-sync/issues/96
    expect(response.successful).toBeTruthy();    
    expect(actualMembers).toHaveLength(1);
    expect(actualMembers[0]).toEqual(expectedUser1);

    expect(response2.successful).toBeTruthy();    
    expect(actualMembers2).toHaveLength(1);
    expect(actualMembers2[0]).toEqual(expectedUser2);
  });
});