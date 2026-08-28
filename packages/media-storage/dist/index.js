import { join } from 'node:path';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export class LocalFilesystemMediaStorage {
    baseDir;
    baseUrl;
    constructor(options) {
        this.baseDir = options.baseDir;
        this.baseUrl = options.baseUrl;
    }
    async upload(input) {
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
    async delete(storagePath) {
        try {
            await unlink(storagePath);
        }
        catch {
            // ignore
        }
    }
    getUrl(storagePath) {
        return `${this.baseUrl}/${storagePath.replace(this.baseDir, '').replace(/^\\?\//, '')}`;
    }
}
