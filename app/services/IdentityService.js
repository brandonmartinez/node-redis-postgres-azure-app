// Imports
//////////////////////////////////////////////////
import { ManagedIdentityCredential, AzureCliCredential } from "@azure/identity";

// Main Service Class
//////////////////////////////////////////////////
class IdentityService {
  constructor(options) {
    // If not using managed identities, defaulting to using the Azure CLI's
    // current user credentials (requires az login to have been done)
    this.credential = options.useManagedIdentities
      ? new ManagedIdentityCredential({
          clientId: options.clientId,
        })
      : new AzureCliCredential();
    this.scope = options.scope;
  }

  async getToken() {
    try {
      // Acquire the access token.
      var accessToken = await this.credential.getToken(this.scope);
      return accessToken.token;
    } catch (error) {
      console.error("Failed to get access token:", error);
      return null;
    }
  }
}

// Exports
//////////////////////////////////////////////////
export default IdentityService;
