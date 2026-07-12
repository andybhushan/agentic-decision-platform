/**
 * Azure Blob Storage service for FNOL evidence files.
 * 
 * Live mode: uploads to Azure Blob Storage container.
 * Mock mode: writes files to local disk under backend/data/uploads/.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

export interface BlobUploadResult {
  containerName: string;
  blobName: string;
  size: number;
  mimeType: string;
}

export interface BlobStorageServiceInterface {
  uploadFile(
    sessionId: string,
    evidenceId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<BlobUploadResult>;

  getFileBuffer(containerName: string, blobName: string): Promise<Buffer>;

  getFileUrl(containerName: string, blobName: string): string;
}

/**
 * Mock blob storage — writes to local disk for demo/dev.
 */
export class MockBlobStorageService implements BlobStorageServiceInterface {
  private baseDir: string;
  private containerName = 'fnol-evidence';

  constructor() {
    this.baseDir = join(__dirname, '../../../data/uploads');
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadFile(
    sessionId: string,
    evidenceId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<BlobUploadResult> {
    const ext = extname(originalName) || this.mimeToExt(mimeType);
    const blobName = `${sessionId}/${evidenceId}${ext}`;
    const fullPath = join(this.baseDir, blobName);

    // Ensure session directory exists
    const dir = join(this.baseDir, sessionId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, buffer);

    return {
      containerName: this.containerName,
      blobName,
      size: buffer.length,
      mimeType,
    };
  }

  async getFileBuffer(_containerName: string, blobName: string): Promise<Buffer> {
    const fullPath = join(this.baseDir, blobName);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${blobName}`);
    }
    return readFileSync(fullPath);
  }

  getFileUrl(_containerName: string, blobName: string): string {
    return `/api/v1/fnol/evidence-files/${blobName}`;
  }

  private mimeToExt(mime: string): string {
    switch (mime) {
      case 'image/jpeg': return '.jpg';
      case 'image/png': return '.png';
      case 'image/webp': return '.webp';
      default: return '.bin';
    }
  }
}

/**
 * Live Azure Blob Storage service.
 */
export class AzureBlobStorageService implements BlobStorageServiceInterface {
  private containerClient: ContainerClient;
  private containerName: string;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    this.containerName = process.env.EVIDENCE_CONTAINER_NAME || 'fnol-evidence';

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = blobServiceClient.getContainerClient(this.containerName);
  }

  async uploadFile(
    sessionId: string,
    evidenceId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<BlobUploadResult> {
    const ext = extname(originalName) || '.bin';
    const blobName = `${sessionId}/${evidenceId}${ext}`;

    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });

    return {
      containerName: this.containerName,
      blobName,
      size: buffer.length,
      mimeType,
    };
  }

  async getFileBuffer(_containerName: string, blobName: string): Promise<Buffer> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    const response = await blockBlobClient.download(0);
    const chunks: Buffer[] = [];
    for await (const chunk of response.readableStreamBody as NodeJS.ReadableStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  getFileUrl(_containerName: string, blobName: string): string {
    return `/api/v1/fnol/evidence-files/${blobName}`;
  }
}

/**
 * Factory to create blob storage service based on environment.
 */
export class BlobStorageFactory {
  static create(): BlobStorageServiceInterface {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!connectionString || connectionString === 'mock') {
      console.log('📁 Using mock blob storage (local disk)');
      return new MockBlobStorageService();
    }

    console.log('☁️ Using Azure Blob Storage');
    return new AzureBlobStorageService();
  }
}
