// Imports
//////////////////////////////////////////////////
import redis from "redis";
import {
  DefaultAzureCredential,
  ManagedIdentityCredential,
  AzureCliCredential,
} from "@azure/identity";
import pg from "pg";
import express from "express";

// needed for commonjs modules
const { Client } = pg;

// Shared Variables
//////////////////////////////////////////////////
const expressPort = process.env.NODE_EXPRESS_PORT || 3000;
const useManagedIdentities = process.env.USE_MANAGED_IDENTITIES === "true";
const managedIdentityUserName =
  process.env.POSTGRES_USER_MANAGED_IDENTITY_USERNAME;
const postgresUserName = useManagedIdentities
  ? managedIdentityUserName
  : process.env.ENTRA_USER_EMAIL;
const postgresDatabaseName = process.env.POSTGRES_DATABASE_NAME;
const postgresPort = Number(process.env.POSTGRESQL_PORT);
// If running in a local environment, accept the
// SSL cert since it won't match "localhost"
const postgresSslConfig = useManagedIdentities
  ? true
  : {
      rejectUnauthorized: true,
      checkServerIdentity: () => {},
    };

// If not using managed identities, defaulting to using the Azure CLI's
// current user credentials (requires az login to have been done)
const credential = useManagedIdentities
  ? new ManagedIdentityCredential({
      clientId: process.env.POSTGRES_USER_MANAGED_IDENTITY_CLIENTID,
    })
  : new AzureCliCredential();

// Shared Functions
//////////////////////////////////////////////////

const executePostgresQuery = async (query) => {
  // Acquire the access token.
  var accessToken = await credential.getToken(
    "https://ossrdbms-aad.database.windows.net/.default"
  );

  // console.debug("Access Token acquired: ", accessToken.token);

  // Note: this is not best practice for high-scale applications, consider using a connection pool
  // like PgBouncer: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-connection-pooling-best-practices
  const client = new Client({
    host: process.env.POSTGRES_SERVER,
    // If using managed identities, the user should be the username of the managed identity, otherwise grab the useremail from the environment variables
    user: postgresUserName,
    password: accessToken.token,
    database: postgresDatabaseName,
    port: postgresPort,
    ssl: postgresSslConfig,
  });
  await client.connect();

  let returnValue;
  if (Array.isArray(query)) {
    const results = [];
    for (const q of query) {
      const result = await client.query(q);
      results.push(result);
    }
    returnValue = results;
  } else {
    returnValue = await client.query(query);
  }

  await client.end();

  return returnValue;
};

// Ensure the database has the tables created
//////////////////////////////////////////////////
const createTables = async () => {
  const response = await executePostgresQuery([
    `CREATE TABLE IF NOT EXISTS dataentries (id SERIAL PRIMARY KEY, text VARCHAR(1024) not null, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${managedIdentityUserName}"`,
  ]);

  console.log(response);
};

await createTables();

// Setup the server
//////////////////////////////////////////////////
const app = express();
const port = expressPort;

app.use(express.json());

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get("/", (req, res, next) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

app.post("/api/dataentries", async (req, res, next) => {
  try {
    console.debug(req.body);

    const { text } = req.body;
    const query = `INSERT INTO dataentries (text) VALUES ('${text}')`;
    const response = await executePostgresQuery(query);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/dataentries", async (req, res, next) => {
  try {
    const query = "SELECT * FROM dataentries";
    const response = await executePostgresQuery(query);

    if (response && response.rows) {
      res.status(200).json(response.rows);
    } else {
      res.status(200).json([]);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
