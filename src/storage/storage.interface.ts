export interface FileMetadata {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
}

export interface FileStorageService {
  /** Store a file buffer at the given key */
  put(key: string, buffer: Buffer, metadata: FileMetadata): Promise<void>;

  /** Retrieve a file by key, returns null if not found */
  get(key: string): Promise<Buffer | null>;

  /** Delete a file, returns true if successful */
  delete(key: string): Promise<boolean>;

  /** Generate a signed token for secure downloads */
  generateSignedUrl(key: string, ttlSeconds: number): string;
}
