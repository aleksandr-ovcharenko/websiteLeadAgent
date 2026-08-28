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
export declare class LocalFilesystemMediaStorage implements MediaStorage {
    private baseDir;
    private baseUrl;
    constructor(options: {
        baseDir: string;
        baseUrl: string;
    });
    upload(input: UploadInput): Promise<UploadResult>;
    delete(storagePath: string): Promise<void>;
    getUrl(storagePath: string): string;
}
