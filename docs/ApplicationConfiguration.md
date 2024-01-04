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

# The LDAP Configuration. Eventually this will be moved to a plugin
LDAP_SERVER=
LDAP_USER=
LDAP_PASSWORD=
LDAP_GROUP_BASE_DN=

# Optional
APP_OPTIONS_RedisHost=
GITHUB_PROXY=
SOURCE_PROXY=
PORT=
```