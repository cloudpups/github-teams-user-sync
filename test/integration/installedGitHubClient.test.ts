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
      await client.rest.teams.create({
        name: testConfig.team1.name,
        org: testConfig.orgName
      });

      await client.rest.teams.addOrUpdateMembershipForUserInOrg({
        org: testConfig.orgName,
        team_slug: testConfig.team1.name,
        username: testConfig.team1.member
      });

      await client.rest.teams.create({
        name: testConfig.team2.name,
        org: testConfig.orgName
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
  });

  afterAll(async () => {
    try {
      await client.rest.teams.deleteInOrg({
        org: testConfig.orgName,
        team_slug: testConfig.team1.name
      });

      await client.rest.teams.deleteInOrg({
        org: testConfig.orgName,
        team_slug: testConfig.team2.name
      })
    }
    catch (e) {
      console.log(e);
      throw e;
    }
  })

  test('ListCurrentMembersOfGitHubTeam returns expected team members', async () => {
    // Arrange         
    const installedGitHubClient = new InstalledGitHubClient(client, testConfig.orgName);

    const expectedTeam = testConfig.team1.name;
    const expectedUser = testConfig.team1.member;

    // Act
    const response = await installedGitHubClient.ListCurrentMembersOfGitHubTeam(expectedTeam);

    const actualMembers = response.successful ? response.data : [];

    // Assert     
    expect(response.successful).toBeTruthy();
    expect(actualMembers).toHaveLength(1);
    expect(actualMembers[0]).toEqual(expectedUser);
  });
});