import { join } from 'node:path';
import { writeFile, mkdir, unlink, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export interface UploadInput {
  data: Buffer;
  filename: string;
  mimeType: string;
}

export interface UploadResult {
  filename: string;
  storagePath: string;
  size: number;
}

export interface MediaStorage {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(storagePath: string): Promise<void>;
  getUrl(storagePath: string): string;
}

export class LocalFilesystemMediaStorage implements MediaStorage {
  private baseDir: string;
  private baseUrl: string;

  constructor(options: { baseDir: string; baseUrl: string }) {
    this.baseDir = options.baseDir;
    this.baseUrl = options.baseUrl;
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const hash = createHash('sha256').update(input.data).digest('hex').slice(0, 16);
    const safe = input.filename.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\s+/g, '_');
    const filename = `${hash}-${safe}`;
    const storagePath = join(this.baseDir, filename);
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(storagePath, input.data);
    return {
      filename,
      storagePath,
      size: input.data.length,
    };
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await unlink(storagePath);
    } catch {
      // ignore
    }
  }

  getUrl(storagePath: string): string {
    return `${this.baseUrl}/${storagePath.replace(this.baseDir, '').replace(/^\\?\//, '')}`;
  }
}
