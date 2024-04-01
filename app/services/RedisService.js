// Imports
//////////////////////////////////////////////////
import { createClient } from "redis";

// Main Service Class
//////////////////////////////////////////////////
class RedisService {
  constructor(options) {
    // Assign options to class properties
    this.identityService = options.identityService;

    this.databaseName = options.databaseName;
    this.host = options.host;
    this.port = options.port;
    this.username = options.username;
  }

  async getClient() {
    // Get the token to login
    // Notes on using Entra:
    // https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-azure-active-directory-for-authentication
    const token = await this.identityService.getToken();

    const clientConfig = {
      username: this.username,
      password: token,
      url: `redis://${this.host}:${this.port}`,
      pingInterval: 100000,
      socket: {
        tls: true,
        keepAlive: 0,
      },
    };
    console.debug("redis config", clientConfig);

    // Note: this may not be the most efficient way to connect to Redis; you may
    // want to cache the client and reuse it, or use a connection pool of sorts.
    // Additional samples for different types of apps (e.g., long running):
    // https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/identity/identity/samples/AzureCacheForRedis/node-redis.md
    const client = createClient(clientConfig);
    client.on("error", (err) => console.log("Redis Client Error", err));

    await client.connect();

    return client;
  }

  async executeRedisCommand(command) {
    // this is not super efficient as we're connecting and disconnecting for every command
    const client = await this.getClient();

    const returnValue = await command(client);

    await client.disconnect();

    return returnValue;
  }

  async set(key, value) {
    await this.executeRedisCommand((client) => client.set(key, value));
  }

  async get(key) {
    return await this.executeRedisCommand((client) => client.get(key));
  }

  async keys() {
    return await this.executeRedisCommand((client) => client.keys("*"));
  }

  async mget(keys) {
    return await this.executeRedisCommand((client) => client.mGet(keys));
  }
}

// Exports
//////////////////////////////////////////////////
export default RedisService;
