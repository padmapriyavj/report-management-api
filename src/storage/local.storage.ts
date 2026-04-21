import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { FileStorageService, FileMetadata } from "./storage.interface";
import { config } from "../config";

export class LocalDiskStorage implements FileStorageService {
  private basePath: string;
  private signingSecret: string;

  constructor() {
    this.basePath = config.upload.storagePath;
    this.signingSecret = config.jwt.secret;
    this.ensureDirectory();
  }

  /**
   * Create the uploads directory if it doesn't exist.
   */
  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  /**
   * Write a file to disk. Creates subdirectories as needed.
   */
  async put(
    key: string,
    buffer: Buffer,
    _metadata: FileMetadata
  ): Promise<void> {
    const filePath = path.join(this.basePath, key);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  /**
   * Read a file from disk. Returns null if file doesn't exist.
   */
  async get(key: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(this.basePath, key);
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Delete a file from disk.
   */
  async delete(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.basePath, key);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a signed download token.
   * Format: "signature:expiresTimestamp"
   * The token is verified using HMAC-SHA256.
   */
  generateSignedUrl(key: string, ttlSeconds: number): string {
    const expires = Date.now() + ttlSeconds * 1000;
    const payload = `${key}:${expires}`;
    const signature = crypto
      .createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest("hex");

    return `${signature}:${expires}`;
  }
}
