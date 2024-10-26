# Integration Tests

For the tests in this folder to run, a .env file must be present in the root of the repo so that a GitHub Client can be initialized for testing against GitHub's actual APIs.

The `.env` file must be located at the following path, must have the following shape, and must be named in a particular way (as the name is hardcoded into the integration tests):

## Path

Path: `test/integration/.env.sync-bot.tests`

This can seen in use via a GitHub Action Workflow present within this repo (check for the `Prep .env file for integration tests` step): [build.yml](../../.github/workflows/build.yml)

## Shape

```.env
GitHubApp__AppId={number}
Tests__InstallationId={number}
Tests__OrgName={string}
GitHubApp__PrivateKey={multi-line-string}

Tests_ToMake_Team1_Name={string}
Tests_ToMake_Team1_Member={string}
Tests_ToMake_Team2_Name={string}
Tests_ToMake_Team2_Member={string}
```