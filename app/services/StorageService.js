// Imports
//////////////////////////////////////////////////
import { BlobServiceClient } from "@azure/storage-blob";

// Main Service Class
//////////////////////////////////////////////////
class StorageService {
  constructor(options) {
    // Assign options to class properties
    const identityService = options.identityService;

    this.blobServiceClient = new BlobServiceClient(
      `https://${options.accountName}.blob.core.windows.net`,
      identityService.getCredential()
    );

    this.containerName = options.containerName;
    this.publicBaseUrl = options.publicBaseUrl;
  }

  async getImages() {
    const containerClient = this.blobServiceClient.getContainerClient(
      this.containerName
    );

    const images = [];

    for await (const blob of containerClient.listBlobsFlat()) {
      images.push({
        name: blob.name,
        url: this.publicBaseUrl + blob.name,
      });
    }

    return images;
  }
}

// Exports
//////////////////////////////////////////////////
export default StorageService;
