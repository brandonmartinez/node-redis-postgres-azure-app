// Imports
//////////////////////////////////////////////////
import pg from "pg";

// needed for commonjs modules
const { Client } = pg;

// Main Service Class
//////////////////////////////////////////////////
class PostgresService {
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
    const token = await this.identityService.getToken();

    const clientConfig = {
      host: this.host,
      user: this.username,
      password: token,
      database: this.databaseName,
      port: this.port,
      ssl: true,
    };

    // console.debug("postgres config", clientConfig);

    // Note: this is not best practice for high-scale applications, consider using a connection pool
    // like PgBouncer: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-connection-pooling-best-practices
    const postgresClient = new Client(clientConfig);
    await postgresClient.connect();

    return postgresClient;
  }

  async executeQuery(query) {
    const postgresClient = await this.getClient();

    let returnValue;
    if (Array.isArray(query)) {
      const results = [];
      for (const q of query) {
        const result = await postgresClient.query(q);
        results.push(result);
      }
      returnValue = results;
    } else {
      returnValue = await postgresClient.query(query);
    }

    await postgresClient.end();

    return returnValue;
  }
}

// Exports
//////////////////////////////////////////////////
export default PostgresService;
