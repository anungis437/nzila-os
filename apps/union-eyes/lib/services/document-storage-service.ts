/**
 * Document Storage Service
 * 
 * Handles storage of signed documents and other sensitive files
 * Supports S3, Cloudflare R2, and Azure Blob Storage
 * 
 * Environment Configuration:
 * - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_SIGNATURES_BUCKET (for S3)
 * - CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET, CLOUDFLARE_R2_ENDPOINT (for R2)
 * - AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER (for Azure)
 */

import { logger } from "@/lib/logger";
import crypto from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export type StorageBackend = "s3" | "r2" | "azure";

export interface StorageConfig {
  backend: StorageBackend;
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  connectionString?: string;
}

export interface StorageDocument {
  organizationId: string;
  documentName: string;
  documentBuffer: Buffer;
  documentType: string;
  contentType?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface StorageResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  uploadedAt: Date;
}

// ============================================================================
// STORAGE SERVICE
// ============================================================================

class DocumentStorageService {
  private backend: StorageBackend;
  private bucket: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private s3Client?: any;
  private s3Sdk?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PutObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    GetObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DeleteObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSignedUrl: any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private blobServiceClient?: any;
  private azureConnectionString?: string;
  private r2Endpoint?: string;

  constructor() {
    // Determine which backend to use based on environment variables
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      this.backend = "azure";
      this.bucket = process.env.AZURE_STORAGE_CONTAINER || "signatures";
      this.azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    } else if (process.env.CLOUDFLARE_R2_ENDPOINT) {
      this.backend = "r2";
      this.bucket = process.env.CLOUDFLARE_R2_BUCKET || "union-eyes-signatures";
      this.r2Endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
    } else {
      this.backend = "s3";
      this.bucket = process.env.AWS_SIGNATURES_BUCKET || "union-eyes-signatures";
    }
    logger.info("Document storage service initialized", {
      backend: this.backend,
      bucket: this.bucket,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async ensureAzureClient(): Promise<any> {
    if (this.blobServiceClient) {
      return this.blobServiceClient;
    }

    const moduleLoader = await import("module");
    const require = moduleLoader.createRequire(import.meta.url);
    const azureModule = require("@azure/storage-blob");

    this.blobServiceClient = azureModule.BlobServiceClient.fromConnectionString(
      this.azureConnectionString!
    );

    return this.blobServiceClient;
  }

  private async ensureS3Client(): Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PutObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    GetObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DeleteObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSignedUrl: any;
  }> {
    if (this.s3Client && this.s3Sdk) {
      return this.s3Sdk;
    }

    const moduleLoader = await import("module");
    const require = moduleLoader.createRequire(import.meta.url);
    const s3Module = require("@aws-sdk/client-s3");
    const presignerModule = require("@aws-sdk/s3-request-presigner");

    this.s3Sdk = {
      PutObjectCommand: s3Module.PutObjectCommand,
      GetObjectCommand: s3Module.GetObjectCommand,
      DeleteObjectCommand: s3Module.DeleteObjectCommand,
      getSignedUrl: presignerModule.getSignedUrl,
    };

    if (this.backend === "r2") {
      this.s3Client = new s3Module.S3Client({
        region: "us-east-1",
        endpoint: this.r2Endpoint,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
        },
      });
    } else {
      this.s3Client = new s3Module.S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
    }

    return this.s3Sdk;
  }

  /**
   * Upload document to storage
   */
  async uploadDocument(doc: StorageDocument): Promise<StorageResult> {
    try {
      // Generate unique key: organization/{org-id}/{timestamp}-{random}.pdf
      const timestamp = Date.now();
      const randomBytes = crypto.randomBytes(4).toString("hex");
      const key = `organization/${doc.organizationId}/${timestamp}-${randomBytes}-${doc.documentName}`;

      const contentType = doc.contentType || "application/pdf";
      const uploadedAt = new Date();

      if (this.backend === "azure") {
        // Upload to Azure Blob Storage
        const blobServiceClient = await this.ensureAzureClient();
        const containerClient = blobServiceClient.getContainerClient(this.bucket);
        const blockBlobClient = containerClient.getBlockBlobClient(key);

        await blockBlobClient.upload(doc.documentBuffer, doc.documentBuffer.length, {
          metadata: {
            organizationId: doc.organizationId,
            documentName: doc.documentName,
            documentType: doc.documentType,
            uploadedAt: uploadedAt.toISOString(),
            ...doc.metadata,
          },
        });

        logger.info("Document uploaded to Azure Blob Storage", {
          organizationId: doc.organizationId,
          key,
          size: doc.documentBuffer.length,
        });

        // Generate read-only SAS URL valid for 1 year
        const url = `${blobServiceClient.url}${this.bucket}/${key}`;

        return {
          url,
          key,
          bucket: this.bucket,
          size: doc.documentBuffer.length,
          uploadedAt,
        };
      } else {
        // Upload to S3 or Cloudflare R2
        const { PutObjectCommand, GetObjectCommand, getSignedUrl } = await this.ensureS3Client();
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: doc.documentBuffer,
          ContentType: contentType,
          Metadata: {
            organizationId: doc.organizationId,
            documentName: doc.documentName,
            documentType: doc.documentType,
          },
        });

        await this.s3Client!.send(command);

        logger.info("Document uploaded to S3/R2", {
          organizationId: doc.organizationId,
          key,
          size: doc.documentBuffer.length,
          backend: this.backend,
        });

        // Generate pre-signed URL valid for 1 year
        const getCommand = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });

        const url = await getSignedUrl(this.s3Client!, getCommand, {
          expiresIn: 365 * 24 * 60 * 60, // 1 year
        });

        return {
          url,
          key,
          bucket: this.bucket,
          size: doc.documentBuffer.length,
          uploadedAt,
        };
      }
    } catch (error) {
      logger.error("Failed to upload document", {
        error,
        organizationId: doc.organizationId,
        documentName: doc.documentName,
      });
      throw error;
    }
  }

  /**
   * Download document from storage
   */
  async downloadDocument(key: string): Promise<Buffer> {
    try {
      if (this.backend === "azure") {
        // Download from Azure Blob Storage
        const blobServiceClient = await this.ensureAzureClient();
        const containerClient = blobServiceClient.getContainerClient(this.bucket);
        const blockBlobClient = containerClient.getBlockBlobClient(key);
        const downloadBlockBlobResponse = await blockBlobClient.download(0);
        const downloadedData = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody!);

        logger.info("Document downloaded from Azure Blob Storage", { key });
        return downloadedData;
      } else {
        // Download from S3 or Cloudflare R2
        const { GetObjectCommand } = await this.ensureS3Client();
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });

        const response = await this.s3Client!.send(command);
        const buffer = await streamToBuffer(response.Body!);

        logger.info("Document downloaded from S3/R2", { key, backend: this.backend });
        return buffer;
      }
    } catch (error) {
      logger.error("Failed to download document", { error, key });
      throw error;
    }
  }

  /**
   * Delete document from storage
   */
  async deleteDocument(key: string): Promise<void> {
    try {
      if (this.backend === "azure") {
        // Delete from Azure Blob Storage
        const blobServiceClient = await this.ensureAzureClient();
        const containerClient = blobServiceClient.getContainerClient(this.bucket);
        await containerClient.deleteBlob(key);

        logger.info("Document deleted from Azure Blob Storage", { key });
      } else {
        // Delete from S3 or Cloudflare R2
        const { DeleteObjectCommand } = await this.ensureS3Client();
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });

        await this.s3Client!.send(command);

        logger.info("Document deleted from S3/R2", { key, backend: this.backend });
      }
    } catch (error) {
      logger.error("Failed to delete document", { error, key });
      throw error;
    }
  }

  /**
   * Get storage backend information
   */
  getBackendInfo() {
    return {
      backend: this.backend,
      bucket: this.bucket,
      endpoint: this.backend === "r2" ? this.r2Endpoint : undefined,
    };
  }
}

// ============================================================================
// STREAM TO BUFFER UTILITY
// ============================================================================

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let storageService: DocumentStorageService | null = null;

export function getDocumentStorageService(): DocumentStorageService {
  if (!storageService) {
    storageService = new DocumentStorageService();
  }
  return storageService;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default DocumentStorageService;

