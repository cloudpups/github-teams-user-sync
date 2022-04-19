## Setup

### ENV Vars

```sh
AZURE_TENANT_ID="The ID for the Active Directory tenant that the service principal belongs to."
AZURE_CLIENT_ID="The name or ID of the service principal."
AZURE_CLIENT_SECRET="The secret associated with the service principal."
```

### Windows

```
winget install golang.go
```

## Helpful Articles

* [Azure Auth and Go](https://docs.microsoft.com/en-us/azure/developer/go/azure-sdk-authorization#use-environment-based-authentication)