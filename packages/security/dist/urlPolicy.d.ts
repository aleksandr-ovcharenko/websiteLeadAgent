export interface PolicyResult {
    allowed: boolean;
    reason?: string;
}
export declare function isAllowedUrl(urlString: string): Promise<PolicyResult>;
export declare function assertAllowedUrl(urlString: string): Promise<void>;
export declare function isAllowedUrlSync(urlString: string, resolvedAddresses: string[]): PolicyResult;
