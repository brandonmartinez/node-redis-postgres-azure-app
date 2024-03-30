// Imports
//////////////////////////////////////////////////
import redis from "redis";
import { DefaultAzureCredential } from "@azure/identity";
import pg from "pg";
import express from "express";
import path from "path";

// Shared Variables
//////////////////////////////////////////////////
const useManagedIdentities = process.env.USE_MANAGED_IDENTITIES === "true";

const { Client } = pg;

// If not using managed identities, will default to the current AZ CLI logged in user (for local dev)
const clientId = process.env.POSTGRES_USER_MANAGED_IDENTITY_CLIENTID;
const credentialsConfiguration = useManagedIdentities
  ? {
      managedIdentityClientId: clientId,
    }
  : {};
const credential = new DefaultAzureCredential(credentialsConfiguration);

// Acquire the access token.
var accessToken = await credential.getToken(
  "https://ossrdbms-aad.database.windows.net/.default"
);

console.log(accessToken.token);

// Use the token and the connection information from the environment variables added by Service Connector to establish the connection.
(async () => {
  const client = new Client({
    host: process.env.POSTGRES_SERVER,
    // If using managed identities, the user should be the username of the managed identity, otherwise grab the useremail from the environment variables
    user: useManagedIdentities
      ? process.env.POSTGRES_USER_MANAGED_IDENTITY_USERNAME
      : process.env.ENTRA_USER_EMAIL,
    password: accessToken.token,
    database: process.env.POSTGRES_DATABASE_NAME,
    port: Number(process.env.POSTGRESQL_PORT),
    ssl: {
      rejectUnauthorized: true,
      checkServerIdentity: () => {},
    },
  });
  await client.connect();

  await client.end();
})();

const app = express();
const port = process.env.NODE_EXPRESS_PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get("/", (req, res, next) => {
  res.sendFile(process.cwd() + "/public/index.html");
});
