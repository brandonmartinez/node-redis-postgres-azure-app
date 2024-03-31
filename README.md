# node-redis-postgres-azure-app

A small app that tests connectivity to Redis and PostgreSQL on Azure within a
Node.js environment. This app is intended to be used as a reference for the
repository
[brandonmartinez/afd-appservices-postgres-redis-sample](https://github.com/brandonmartinez/afd-appservices-postgres-redis-sample)
to demonstrate how an application would utilize infrastructure that has private
networking and user-managed identities defined across the entire application.

## Local Development

https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-connect-with-managed-identity

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

#### PostgreSQL

To connect to Postgres:

psql "host=localhost port=5432 dbname=<database-name>
user=<your-postgresql-server-username>@<your-postgresql-server-name>
password=<your-password-for-the-database> sslmode=require"

#### Redis

To connect to Redis:

redis-cli -h localhost -p 6379 -a <your-redis-password>

### Gotchas

If you are unable to bind to the ports, you may need to kill the connected
processes:

```sh
killall ssh

killall python3
```

## Running in Azure

When the image is deployed…

### Postgres Notes

The managed identity may need to have permissions assigned to it in order to
access the data within the database. To do this, login as the non-Entra
administrator (or an administrator that has had privileges assigned to them) and
run the following SQL query:

```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "YOUR_MANAGED_IDENTITY_NAME"
```
