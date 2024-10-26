import {beforeAll, describe, expect, test} from '@jest/globals';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import dotenv from 'dotenv';
import { InstalledGitHubClient } from '../../src/services/installedGitHubClient';

describe('InstalledGitHubClient Class', () => {
  let appConfig:{
    installationId: number,
    appId: number,
    privateKey: string,
    orgName: string
  };

  beforeAll(() => {
    dotenv.config({
      // See `tests/integration/README.md` for more information
      path:"test/integration/.env.sync-bot.tests"
    })
    
    appConfig = {
      appId: process.env.GitHubApp__AppId! as unknown as number,
      installationId: process.env.Tests__InstallationId! as unknown as number,
      privateKey: process.env.GitHubApp__PrivateKey!,
      orgName: process.env.Tests__OrgName!
    }        
  });

  test('ListCurrentMembersOfGitHubTeam returns expected team members', async () => {
    // Arrange 
    const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: appConfig
    });
    
    const installedGitHubClient = new InstalledGitHubClient(octokit, appConfig.orgName);

    // TODO: extract out test team
    const testTeam = "Team1"

    // Act
    const response = await installedGitHubClient.ListCurrentMembersOfGitHubTeam(testTeam);

    const actualMembers = response.successful ? response.data : [];

    // Assert     
    expect(response.successful).toBeTruthy();   
    expect(actualMembers).toHaveLength(1);
    
    // TODO: extract out test username
    expect(actualMembers[0]).toEqual("JoshuaTheMiller");
  });
});