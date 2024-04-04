// Imports
//////////////////////////////////////////////////
import IdentityService from "./services/IdentityService.js";
import RedisService from "./services/RedisService.js";
import PostgresService from "./services/PostgresService.js";
import StorageService from "./services/StorageService.js";
import express from "express";
import applicationinsights from "applicationinsights";

// Environment Variables
//////////////////////////////////////////////////
const expressPort = process.env.NODE_EXPRESS_PORT || 3000;
const useManagedIdentities = process.env.USE_MANAGED_IDENTITIES === "true";

// Service Setup
//////////////////////////////////////////////////
applicationinsights
  .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setDistributedTracingMode(
    applicationinsights.DistributedTracingModes.AI_AND_W3C
  )
  .setSendLiveMetrics(true)
  .setInternalLogging(true, true)
  .start();
const appInsightsClient = applicationinsights.defaultClient;

const storageIdentityService = new IdentityService({
  useManagedIdentities,
  clientId: process.env.AZURE_STORAGE_ACCOUNT_MANAGED_IDENTITY_CLIENTID,
  scope: "https://storage.azure.com/.default",
});
const storageService = new StorageService({
  identityService: storageIdentityService,
  accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  containerName: process.env.AZURE_STORAGE_ACCOUNT_CONTAINER_NAME,
});

const postgresIdentityService = new IdentityService({
  useManagedIdentities,
  clientId: process.env.POSTGRES_USER_MANAGED_IDENTITY_CLIENTID,
  scope: "https://ossrdbms-aad.database.windows.net/.default",
});
const postgresUserName = useManagedIdentities
  ? process.env.POSTGRES_USER_MANAGED_IDENTITY_USERNAME
  : process.env.ENTRA_USER_EMAIL;
const postgresService = new PostgresService({
  identityService: postgresIdentityService,
  host: process.env.POSTGRES_SERVER,
  databaseName: process.env.POSTGRES_DATABASE_NAME,
  port: Number(process.env.POSTGRES_SERVER_PORT),
  username: postgresUserName,
});

const redisIdentityService = new IdentityService({
  useManagedIdentities,
  clientId: process.env.REDIS_USER_MANAGED_IDENTITY_CLIENTID,
  scope: "https://redis.azure.com/.default",
});

const redisService = new RedisService({
  identityService: redisIdentityService,
  host: process.env.REDIS_SERVER,
  port: Number(process.env.REDIS_SERVER_PORT),
  username: useManagedIdentities
    ? process.env.REDIS_USER_MANAGED_IDENTITY_USERNAME
    : process.env.ENTRA_USER_OBJECTID,
});

// Ensure the database has the tables created
//////////////////////////////////////////////////

// NOTE: this should be done as part of a database deployment process
// Attempting to create a new user that will own the database tables and a table for sample data
const createTables = async () => {
  const response = await postgresService.executeQuery([
    `DO $do$ BEGIN IF (SELECT COUNT(*) FROM pg_roles WHERE rolname = 'webapp_admin') = 0 THEN CREATE ROLE webapp_admin WITH NOLOGIN ADMIN azure_pg_admin; END IF; END $do$;`,
    `GRANT ALL PRIVILEGES ON SCHEMA public TO "webapp_admin";`,
    `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "webapp_admin";`,
    `CREATE TABLE IF NOT EXISTS dataentries (id SERIAL PRIMARY KEY, text VARCHAR(1024) not null, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
    `ALTER TABLE dataentries OWNER TO webapp_admin;`,
  ]);

  console.log(response);
};

await createTables();

// Setup the server
//////////////////////////////////////////////////
const app = express();
const port = expressPort;

// Setup middleware
app.use(express.json());
app.use(express.static("public"));

// Configure routes
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get("/appinsights-connectionstring.js", (req, res, next) => {
  res.send(
    `window.applicationinsights_connection_string = "${process.env.APPLICATIONINSIGHTS_CONNECTION_STRING}";`
  );
});

app.post("/api/dataentries", async (req, res, next) => {
  try {
    appInsightsClient.trackEvent({
      name: "Data Entry Posted",
      properties: { text: req.body.text },
    });

    const { text } = req.body;

    // Insert data to Postgres
    const query = `INSERT INTO dataentries (text) VALUES ('${text}') RETURNING id`;
    const response = await postgresService.executeQuery(query);
    console.log(response);

    // update in cache
    await redisService.set(`dataentries-${response.rows[0].id}`, text);

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    appInsightsClient.trackException({
      exception: error,
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/cacheentries", async (req, res, next) => {
  try {
    appInsightsClient.trackEvent({
      name: "Cache Entries Requested",
    });

    const keys = await redisService.keys("dataentries-*");
    const entries = await redisService.mget(keys);

    const mappedEntries = keys
      .map((key, index) => ({
        key,
        value: entries[index],
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    res.status(200).json(mappedEntries);
  } catch (error) {
    console.error(error);
    appInsightsClient.trackException({
      exception: error,
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/dataentries", async (req, res, next) => {
  try {
    appInsightsClient.trackEvent({
      name: "Data Enties Requested",
    });

    const query = "SELECT * FROM dataentries";
    const response = await postgresService.executeQuery(query);

    if (response && response.rows) {
      res.status(200).json(response.rows);
    } else {
      res.status(200).json([]);
    }
  } catch (error) {
    console.error(error);
    appInsightsClient.trackException({
      exception: error,
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/cache/:id", async (req, res, next) => {
  try {
    appInsightsClient.trackEvent({
      name: "Cache Entry Requested",
      properties: { id: req.params.id },
    });
    const id = req.params.id;
    const response = await redisService.get(`dataentries-${id}`);

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    appInsightsClient.trackException({
      exception: error,
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/images", async (req, res, next) => {
  try {
    appInsightsClient.trackEvent({
      name: "Storage Account Images Requested",
    });
    const id = req.params.id;
    const response = await storageService.getImages();

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    appInsightsClient.trackException({
      exception: error,
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
});
