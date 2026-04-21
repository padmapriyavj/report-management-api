export interface FileMetadata {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
}

export interface FileStorageService {
  put(key: string, buffer: Buffer, metadata: FileMetadata): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<boolean>;
  generateSignedUrl(key: string, ttlSeconds: number): string;
}
