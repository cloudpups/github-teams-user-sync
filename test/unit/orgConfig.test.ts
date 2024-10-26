import {describe, expect, test} from '@jest/globals';
import { ManagedGitHubTeam, OrgConfig, OrgConfigurationOptions } from '../../src/services/orgConfig';

describe('OrgConfigClass', () => {
  test('Sets proper defaults', () => {
    // Arrange
    const rawConfig = {};
    const emptyStringArray:string[] = [];
    const emptyMap:Map<string,string> = new Map();

    // Act
    const config = new OrgConfig(rawConfig);

    // Assert        
    expect(config.AdditionalSecurityManagerGroups).toStrictEqual(emptyStringArray);
    expect(config.AssumeMembershipViaTeams).toBeFalsy();
    expect(config.CopilotTeams).toStrictEqual(emptyStringArray);
    expect(config.DisplayNameToSourceMap).toStrictEqual(emptyMap);
    expect(config.OrgMembersGroupName).toBeUndefined();
    expect(config.OrgOwnersGroupName).toBeUndefined();
    expect(config.TeamsToManage).toStrictEqual(emptyStringArray);
  });

  test('Sets GitHubTeamNames to display name groups properly', () => {
    // Arrange
    const teamNames = [
      "team1",
      "team2"
    ]
    const rawConfig:OrgConfigurationOptions = {
      GitHubTeamNames:teamNames
    };    

    // Act
    const config = new OrgConfig(rawConfig);

    // Assert        
    const expectedTeamsToManage = teamNames;
    const displayNameMap = new Map<string,string>();
    displayNameMap.set(teamNames[0], teamNames[0]);
    displayNameMap.set(teamNames[1], teamNames[1]);
    expect(config.DisplayNameToSourceMap).toStrictEqual(displayNameMap);
    expect(config.TeamsToManage).toStrictEqual(expectedTeamsToManage);
    expect(config.TeamsToManage).toHaveLength(2);
  });

  test('Creates proper name to display name map', () => {
    // Arrange
    const team1:ManagedGitHubTeam = {
      Name: "SomeCopilotTeam",
      DisplayName: "Some Copilot Team"
    };
    const team2:ManagedGitHubTeam = {
      Name: "SomeName"
    }
    const orgOwnersTeam:ManagedGitHubTeam = {
      Name: "SomeOrgOwner",
      DisplayName: "Some Org Owner"
    }
    const securityManagerTeam:ManagedGitHubTeam = {
      Name: "SomeSecurityManagerTeam",
      DisplayName: "Some Security Manager Team"
    }
    const orgMembersTeam:ManagedGitHubTeam = {
      Name: "SomeMembersGroup",
      DisplayName: "Some Members Group"
    }
    const rawConfig:OrgConfigurationOptions = {
      Teams:[
        team1,
        team2
      ],
      OrganizationOwnersGroup: orgOwnersTeam,
      OrganizationMembersGroup: orgMembersTeam,
      AdditionalSecurityManagerGroups: [securityManagerTeam]
    };

    // Act
    const config = new OrgConfig(rawConfig);

    // Assert                    
    const expectedTeamsToManage = [
      team1.DisplayName,
      team2.Name,
      securityManagerTeam.DisplayName,
      orgOwnersTeam.DisplayName,
      orgMembersTeam.DisplayName
    ];
    const displayNameMap = new Map<string,string>();
    displayNameMap.set(team1.DisplayName!, team1.Name);
    displayNameMap.set(team2.Name, team2.Name);
    displayNameMap.set(orgOwnersTeam.DisplayName!, orgOwnersTeam.Name);
    displayNameMap.set(securityManagerTeam.DisplayName!, securityManagerTeam.Name);
    displayNameMap.set(orgMembersTeam.DisplayName!, orgMembersTeam.Name);

    expect(config.DisplayNameToSourceMap).toStrictEqual(displayNameMap);        
    expect(config.TeamsToManage).toStrictEqual(expectedTeamsToManage);    
    expect(config.TeamsToManage).toHaveLength(5);
  });

  test('Handles OrgOwnersGroup being a string', () => {
    // Arrange
    const orgOwnersGroup = "SomeGroup";
    const rawConfig:OrgConfigurationOptions = {
      OrganizationOwnersGroup: orgOwnersGroup
    };    

    // Act
    const config = new OrgConfig(rawConfig);

    // Assert        
    const expectedTeamsToManage = [orgOwnersGroup];
    const displayNameMap = new Map<string,string>();
    displayNameMap.set(orgOwnersGroup, orgOwnersGroup);    
    expect(config.OrgOwnersGroupName).toStrictEqual(orgOwnersGroup);
    expect(config.TeamsToManage).toStrictEqual(expectedTeamsToManage);
    expect(config.TeamsToManage).toHaveLength(1);
  });

  test('Handles OrgMembersGroup being a string', () => {
    // Arrange
    const orgMembersGroup = "SomeGroup";
    const rawConfig:OrgConfigurationOptions = {
      OrganizationMembersGroup: orgMembersGroup
    };    

    // Act
    const config = new OrgConfig(rawConfig);

    // Assert        
    const expectedTeamsToManage = [orgMembersGroup];
    const displayNameMap = new Map<string,string>();
    displayNameMap.set(orgMembersGroup, orgMembersGroup);    
    expect(config.OrgMembersGroupName).toStrictEqual(orgMembersGroup);
    expect(config.TeamsToManage).toStrictEqual(expectedTeamsToManage);
    expect(config.TeamsToManage).toHaveLength(1);
  });
});