// Imports
//////////////////////////////////////////////////
import IdentityService from "./services/IdentityService.js";
import RedisService from "./services/RedisService.js";
import PostgresService from "./services/PostgresService.js";
import express from "express";

// Environment Variables
//////////////////////////////////////////////////
const expressPort = process.env.NODE_EXPRESS_PORT || 3000;
const useManagedIdentities = process.env.USE_MANAGED_IDENTITIES === "true";

// Service Setup
//////////////////////////////////////////////////
const postgresIdentityService = new IdentityService({
  useManagedIdentities,
  clientId: process.env.POSTGRES_USER_MANAGED_IDENTITY_CLIENTID,
  scope: "https://ossrdbms-aad.database.windows.net/.default",
});
const postgresService = new PostgresService({
  identityService: postgresIdentityService,
  host: process.env.POSTGRES_SERVER,
  databaseName: process.env.POSTGRES_DATABASE_NAME,
  port: Number(process.env.POSTGRES_SERVER_PORT),
  username: useManagedIdentities
    ? process.env.POSTGRES_USER_MANAGED_IDENTITY_USERNAME
    : process.env.ENTRA_USER_EMAIL,
});

const redisIdentityService = new IdentityService({
  useManagedIdentities,
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
const createTables = async () => {
  const response = await postgresService.executeQuery([
    `CREATE TABLE IF NOT EXISTS dataentries (id SERIAL PRIMARY KEY, text VARCHAR(1024) not null, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
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

    // Insert data to Postgres
    const query = `INSERT INTO dataentries (text) VALUES ('${text}') RETURNING id`;
    const response = await postgresService.executeQuery(query);
    console.log(response);

    // update in cache
    await redisService.set(`dataentries-${response.rows[0].id}`, text);

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/dataentries", async (req, res, next) => {
  try {
    const query = "SELECT * FROM dataentries";
    const response = await postgresService.executeQuery(query);

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

app.get("/api/cache/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const response = await redisService.get(`dataentries-${id}`);

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
