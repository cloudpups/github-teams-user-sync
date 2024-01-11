# Configuring the GitHub App Registration

As this bot interacts with Github, it needs a GitHub App registration to be created for proper authentication.

## Permissions

This bot currently requires a GitHub App Registration to have the following permissions:

```yaml
repository:contents: Read-only
repository:deployments: Read-and-write # Under review for removal
repository:metadata: Read-only

organization:administration: Read-and-write # See note about Organization Administration Note below
organization:members: Read-and-write

# Upcoming
repository:checks: Read-and-write
repository:commit-statuses: Read-and-write
repository:pull-requests: Read

organization:github-copilot-business: Read-and-write
```

## Events

TBD

## Organization Administration Note

* This permission is needed for managing [Security Managers](https://docs.github.com/en/enterprise-cloud@latest/rest/orgs/security-managers?apiVersion=2022-11-28), though as Security Managers is in beta, this permission may also change.
* ❗ **If you do not intend to use this functionality**, feel free to exclude this permission from your GitHub App Registration