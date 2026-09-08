import { type BrowserType } from 'playwright';
export declare function chromiumLaunchArgs(explicitNoSandbox?: boolean): string[];
export declare function launchSandboxedBrowser(launchOptions?: Parameters<BrowserType['launch']>[0]): Promise<import("playwright").Browser>;
