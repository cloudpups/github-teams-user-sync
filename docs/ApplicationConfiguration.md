# Application Configuration

Your local `.env` file will look like the following:

```shell
# AppId from the GitHub App Registration
GitHubApp__AppId=
# The Private Key from the GitHub App Registration
GitHubApp__PrivateKey=

# Text that is appended to the end of a username that is fetched from the 
# source of truth.
APP_OPTIONS_GitHubIdAppend=

# The GitHub Org to look towards for additional application configuration
APP_OPTIONS_AppConfigOrg=
# The GitHub Repository to look towards for additional application configuration
APP_OPTIONS_AppConfigRepo=team-sync-bot-ops

# The URL for the application that exposes the source of teams for consumption by this application.
SOURCE_PROXY=

# Optional
APP_OPTIONS_RedisHost=
GITHUB_PROXY=
PORT=
```

📝 All possible environment variables can be found in the [`config.ts`](https://github.com/cloudpups/github-teams-user-sync/blob/main/src/config.ts) file as well.
