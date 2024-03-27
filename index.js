const redis = require("redis");
import {
  DefaultAzureCredential,
  ClientSecretCredential,
} from "@azure/identity";
const { Client } = require("pg");

const clientId = process.env.POSTGRES_USER_MANAGED_IDENTITY_CLIENTID;
const credential = new DefaultAzureCredential({
  managedIdentityClientId: clientId,
});

// Acquire the access token.
var accessToken = await credential.getToken(
  "https://ossrdbms-aad.database.windows.net/.default"
);

// Use the token and the connection information from the environment variables added by Service Connector to establish the connection.
(async () => {
  const client = new Client({
    host: process.env.AZURE_POSTGRESQL_HOST,
    user: process.env.AZURE_POSTGRESQL_USER,
    password: accessToken.token,
    database: process.env.AZURE_POSTGRESQL_DATABASE,
    port: Number(process.env.AZURE_POSTGRESQL_PORT),
    ssl: process.env.AZURE_POSTGRESQL_SSL,
  });
  await client.connect();

  await client.end();
})();

const express = require("express");
const app = express();
const port = process.env.NODE_EXPRESS_PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get("/", (req, res, next) => {
  res.json(["Tony", "Lisa", "Michael", "Ginger", "Food"]);
});
