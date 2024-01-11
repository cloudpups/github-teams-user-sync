# Running the Groups to Teams Sync Bot

This application is written to be operating system agnostic. If it does not work properly on a particular operating system, submit an Issue detailing your setup and problem.

We strive to make successfully running and building this application fairly straightforward. The steps are as follows:

1. Install the necessary tooling
2. Prepare your GitHub App registration
3. Prepare your source-of-truth credentials
4. Configure the app
5. Run the app

## 1 Prerequisite Tooling

* NodeJS v20: https://nodejs.org/en/learn/getting-started/how-to-install-nodejs

### Optional

* A container runtime and builder- Docker, Podman, etc.
    * Docker: https://docs.docker.com/get-docker/
    * Podman: https://podman.io/docs

## 2 GitHub App Registration

See [./GitHubAppRegistration.md](./GitHubAppRegistration.md).

## 3 Source of Truth credentials

At this point in time, the logic to fetch information from an LDAP system is baked into this application. Eventually it will be moved to a plugin to make running and developing this application simpler.

At this point in time, you will need to provide 4 values in the application configuration for LDAP:

```sh
LDAP_SERVER=
LDAP_USER=
LDAP_PASSWORD=
LDAP_GROUP_BASE_DN=
```

## 4 Configure the App

See [./ApplicationConfiguration.md](./ApplicationConfiguration.md).

## 5 Run the App

With all the prerequisites out of the way, the following commands will now allow you to run the app:

```sh
npm install
npm run dev
```

After running the commands above, you should eventually see console output similar to the following:

```sh
> teams-sync@1.0.0 dev
> nodemon

[nodemon] 3.0.2
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): src\**\*
[nodemon] watching extensions: ts,json,yaml
[nodemon] starting `ts-node ./src/app.ts`
{
  HostPort: '8080',
  ForwardingGitHubRequestsTo: 'Not forwarding',
  ForwardingGroupRequestsTo: 'Not forwarding',
  RedisCacheHost: 'No cache'
}
Connected to LDAP Server
```