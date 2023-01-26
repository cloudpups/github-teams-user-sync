# group-to-teams-sync-bot

Groups (currently Azure Active Directory Only) to GitHub Teams sync

[![Publish Docker image](https://github.com/cloudpups/github-teams-user-sync/actions/workflows/docker-image.yml/badge.svg?branch=main)](https://github.com/cloudpups/github-teams-user-sync/actions/workflows/docker-image.yml) [![Docker Pulls](https://img.shields.io/docker/pulls/trfc/github-teams-user-sync)](https://hub.docker.com/r/trfc/github-teams-user-sync)

## Configuration File

This service/Action requires that a configuration file be present in the `.github` repository of your GitHub Organization. An example of this is show below:

Filename: `team-sync-options.yaml`
```yaml
# This property is used to control the addition of general Members to your Organization.
OrganizationMembersGroup: Some_Group_To_Sync_For_Organization_Membership
# This property is used for syncing all other GitHub Teams. Please note that users must also be a part of the `OrganizationMembersGroup` for the synchronization of the teams below to function properly.
GitHubTeamNames:
- Some_Team_To_Sync
- Some_Other_Team_To_Sync
```

## Necessary configuration of the tool/service

As of this writing, this sync tool can be ran as a standalone app, or as a GitHub Action.

### As a Standalon App

An Azure AD App registration must be created with the following permissions:

* **Application** Permission: `GroupMember.Read.All`
* **Application** Permission: `User.Read.All`

The Client ID and Client Secret must be provided as environment variables to the application.

A GitHub App registration must be created with the following permissions (this information should be moved to an `app.yml file` instead of being documented here):

* Repository- Contents: Read (only necessary for the `.github` repository)
* Repository- Deployments: Read and Write (only necessary for the `.github` repository)
* Organization- Members: Read and Write

The AppId and Private Key must be provided as environment variables to the application.

### As a GitHub Action

An Azure AD App Registration must still be created (as documented above), and the client ID and secret must be passed to the Action.

An org administrator PAT with the following permissions must be provided:

* write:org
* read:org
* public_repo
* repo_deployment
