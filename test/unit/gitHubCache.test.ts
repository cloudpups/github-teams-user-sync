import { describe, expect, test } from '@jest/globals';
import { GitHubClientCache } from '../../src/services/gitHubCache';
import { IRawInstalledGitHubClient } from '../../src/services/gitHubTypes';
import { ILogger } from '../../src/logging';
import { anyString, instance, mock, when } from 'ts-mockito';
import { ICacheClient } from '../../src/services/CacheClient';

describe('GitHubCacheClass -- ListCurrentMembersOfGitHubTeam', () => {
    test('Should fetch members from cache when there are no changes', async () => {
        // Test 1
        // When etag comes back as no changes, then
        // * it should be cached again anyways
        // * team members should be fetched from the cache
        // * return members   

        // Arrange
        const orgName = "some_org";
        const teamName = "some_team_name";
        const teamMembers = ["1", "2"];

        const teamSlug = `${orgName}_${teamName}`;
        const eTagCacheKey = `t-e:${teamSlug}`;
        const teamCacheKey = `t:${teamSlug}`;

        const gitHubClientMock = mock<IRawInstalledGitHubClient>();

        when(gitHubClientMock.ListMembersOfTeamEtagCheck(anyString(), anyString())).thenResolve({
            successful: "no_changes",
            eTag: "asdf"
        });

        when(gitHubClientMock.GetCurrentOrgName()).thenReturn(orgName);

        const cacheClientMock = mock<ICacheClient>();
        when(cacheClientMock.get(eTagCacheKey)).thenResolve("asdf")
        when(cacheClientMock.get(teamCacheKey)).thenResolve(JSON.stringify(teamMembers));

        const loggerMock = mock<ILogger>();

        const gitHubCache = new GitHubClientCache(instance(gitHubClientMock), instance(cacheClientMock), loggerMock);

        // Act  
        const membersResponse = await gitHubCache.ListCurrentMembersOfGitHubTeam(teamName);

        // Assert   
        expect(membersResponse.successful).toBeTruthy();
        expect(membersResponse.successful ? membersResponse.data : []).toHaveLength(2);
        // check that etag was cached via cache client.
        // check that members were fetched via cache client.
        // check that the plain list members from the GitHub client was not called.
    });

    // Test 2
    // When etag comes back as no changes, then
    // * it should be cached again anyways
    // * team members should be fetched from the cache
    // If member fetch from cache fails for whatever reason, fetch from GitHub then
    // * cache new members
    // * return members

    // Test 3
    // When etag comes back as successfull (meaning changes), then
    // * new etag should be cached anyways        
    // Fetch new members from GitHub
    // * cache new members
    // * return members
});

