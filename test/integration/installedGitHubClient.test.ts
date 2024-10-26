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

  let testConfig:{
    team1: {
      name:string
      member:string
    },
    team2: {
      name:string
      member:string
    }
  }

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
    
    // TODO: create teams and assign membership at test start
    testConfig = {
      team1: {
        name: process.env.Tests_ToMake_Team1_Name!,
        member: process.env.Tests_ToMake_Team1_Member!
      },
      team2: {
        name: process.env.Tests_ToMake_Team2_Name!,
        member: process.env.Tests_ToMake_Team2_Member!
      }
    }
  });

  test('ListCurrentMembersOfGitHubTeam returns expected team members', async () => {
    // Arrange 
    const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: appConfig
    });
    
    const installedGitHubClient = new InstalledGitHubClient(octokit, appConfig.orgName);

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