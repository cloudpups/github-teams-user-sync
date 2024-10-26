import { describe, expect, test } from '@jest/globals';
import { GitHubClientCache } from '../../src/services/gitHubCache';
import { IRawInstalledGitHubClient } from '../../src/services/gitHubTypes';
import { InMemoryCache } from '../InMemoryCache';
import { ILogger } from '../../src/logging';
import {anyString, mock, when} from 'ts-mockito';

describe('GitHubCacheClass', () => {
    test('Sets proper defaults', () => {
        // Arrange
        const gitHubClientMock = mock<IRawInstalledGitHubClient>();
        when(gitHubClientMock.ListMembersOfTeamEtagCheck(anyString(), anyString())).thenResolve({
            successful: "no_changes",
            eTag: "asdf"
        });

        // Test 1
        // When etag comes back as no changes, then
        // * it should be cached again anyways
        // * team members should be fetched from the cache
        // * return members

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

        const loggerMock = mock<ILogger>();
        const inMemoryCache = new InMemoryCache();

        const gitHubCache = new GitHubClientCache(gitHubClientMock, inMemoryCache, loggerMock);

        // Act    

        // Assert        
    });
});