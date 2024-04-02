# node-redis-postgres-azure-app

A small app that tests connectivity to Redis and PostgreSQL on Azure within a
Node.js environment. This app is intended to be used as a reference for the
repository
[brandonmartinez/afd-appservices-postgres-redis-sample](https://github.com/brandonmartinez/afd-appservices-postgres-redis-sample)
to demonstrate how an application would utilize infrastructure that has private
networking and user-managed identities defined across the entire application.

**Table of Contents**

- [node-redis-postgres-azure-app](#node-redis-postgres-azure-app)
  - [Local Development](#local-development)
    - [Connecting to Private Azure Resources](#connecting-to-private-azure-resources)
      - [PostgreSQL](#postgresql)
      - [Redis](#redis)
    - [Gotchas](#gotchas)
      - [Can't Bind to Ports](#cant-bind-to-ports)
      - [Can't Connect to Postgres](#cant-connect-to-postgres)
  - [Running in Azure](#running-in-azure)
  - [Integrating with Your Own Project](#integrating-with-your-own-project)
  - [Security Considerations](#security-considerations)

## Local Development

It is highly recommended to run this repo within the Dev Container that's
provided. This is done most easily by opening the repository folder in
[Visual Studio Code](https://code.visualstudio.com/docs/devcontainers/containers)
or by
[forking the repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo)
and using [GitHub Codespaces](https://github.com/features/codespaces).

### Connecting to Private Azure Resources

To connect to the remote Azure resources, you can establish a local SSH tunnel
to the VM jumpbox and then a double-tunnel to the resources. This is done by
executing the following commands:

```sh
./tunnels.sh
```

You will need to enter your SSH password for the jumpbox per each resource
tunnel.

When running in the Dev Container, these ports are also forwarded to your local
machine, so you will be able to use your local terminal or other applications to
connect to the resources.

It is important to note that you will **not** be able to use the managed
identity to connect to the resources unless you SSH into the Jumpbox and work
directly from there. Managed identities require access to a non-routable IP
address that issues tokens, which cannot be forwarded to through the
double-tunnel.

As such, you will either need to use administrator account credentials, access
keys, or assign another Entra user that has access to the resources. Assuming
you ran the sample ARM template from
[the other repository](https://github.com/brandonmartinez/afd-appservices-postgres-redis-sample),
your current user should already have access assigned to both Postgres and Redis
and your `az` login should be able to get an access token.

The Dev Container has the CLI tooling already installed for you to test
connections to Postgres and Redis. However, before you can connect you'll need
to get a token scoped to each of those resources. This also assumes you have the
`./tunnels.sh` script running in another shell session.

#### PostgreSQL

To connect to Postgres:

```sh
# Load your environment variables from the config you already created
source .env

# Get a token from AZ CLI
AZ_USER=$(az ad signed-in-user show --query userPrincipalName --output tsv)
ACCESS_TOKEN=$(az account get-access-token --query accessToken --output tsv --scope "https://ossrdbms-aad.database.windows.net/.default")

# Connect to the database through the tunnel
psql "host=$POSTGRES_SERVER port=$POSTGRES_SERVER_PORT dbname=$POSTGRES_DATABASE_NAME user=$AZ_USER password=$ACCESS_TOKEN sslmode=require"
```

Additionally, you can use any Postgres client to connect to the database using
the same connection information as Dev Container ports are forwarded to your
local machine.

Note: as with any Postgres installation, you'll need to ensure you have
permissions assigned to your user to access data.

#### Redis

To connect to Redis:

```sh
# Load your environment variables from the config you already created
source .env

# Get a token from AZ CLI
AZ_USER=$(az ad signed-in-user show --query id --output tsv)
ACCESS_TOKEN=$(az account get-access-token --query accessToken --output tsv --scope "https://redis.azure.com/.default")

# Connect to the cache through the tunnel
redis-cli -u "redis://$REDIS_SERVER:$REDIS_SERVER_PORT" --user "$AZ_USER" --pass "$ACCESS_TOKEN" --tls
```

Additionally, you can use any Redis client to connect to the database using the
same connection information as Dev Container ports are forwarded to your local
machine.

### Gotchas

#### Can't Bind to Ports

If you are unable to bind to the ports when running `./tunnels.sh`, you may need
to kill the connected processes:

```sh
killall ssh

killall python3
```

Re-run `./tunnels.sh` after that and you should be able to bind. If not, restart
the Dev Container and try again.

#### Can't Connect to Postgres

The managed identity may need to have permissions assigned to it in order to
access the data within the database. To do this, login as the non-Entra
administrator (or an administrator that has had privileges assigned to them) and
run the following SQL query:

```sql
GRANT azure_pg_admin TO "YOUR_MANAGED_IDENTITY_NAME";
GRANT ALL ON DATABASE webapp TO "YOUR_MANAGED_IDENTITY_NAME";
GRANT ALL ON SCHEMA public TO "YOUR_MANAGED_IDENTITY_NAME";
```

This should only be needed if the managed identity did **not** create the table
in the database. If it did, you will have to grant those additional permissions.

In your own application, you will need to ensure that the managed identity has
the right access to all tables and schemas that it needs access to, just like a
regular `ROLE` would.

More information:
[Create users in Azure Database for PostgreSQL - Flexible Server](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-create-users)

## Running in Azure

When the image is deployed, it should be configured to use the managed
identities that are assigned to the App Service Plan. This will allow the tokens
to be properly retrieved and used to connect to the resources.

## Integrating with Your Own Project

Use this project as a reference for how to connect to Azure resources using
tunnels into a private network via Azure Bastion. You can copy the `tunnels.sh`
script and the `.env` file to your own project and modify the script to your
specific environment's needs.

Review the `IdentityServices.js`, `PostgresService.js`, and `RedisService.js` to
see how the managed identity is used to connect to the resources. You will see
the use of `ManagedIdentityCredential` and `AzureCliCredential` from the
`@azure/identity` package to get the tokens needed to connect to the resources.

If you're not using Node.js, most Microsoft SDKs have a similar credential
system that can be used to get tokens for connecting to Azure resources.

## Security Considerations

It may seem at first that this is a security risk to have local access to Azure
resources, however it is important to keep in mind that through every hop in
this process that identities, policies, and network rules are being validated
along the way.

For more advanced configurations and security considerations, see the following
document that outlines how to create a multilayered just-in-time configuration
for your Azure resources:
[Multilayered protection for Azure virtual machine access](https://learn.microsoft.com/en-us/azure/architecture/solution-ideas/articles/multilayered-protection-azure-vm)
