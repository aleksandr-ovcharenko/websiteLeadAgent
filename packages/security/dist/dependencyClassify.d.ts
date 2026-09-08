export type DependencyEnvironment = 'RUNTIME' | 'DEV' | 'BUILD' | 'UNKNOWN';
export type DependencyReachability = 'REACHABLE' | 'NOT_REACHABLE' | 'UNKNOWN';
export declare const BUILD_TOOLS: Set<string>;
export declare const NETWORK_REACHABLE: Set<string>;
export interface ClassifyDependencyInput {
    packageName: string;
    nodes?: string[];
    isDev?: boolean;
}
export declare function classifyNpmDependency(input: ClassifyDependencyInput): {
    environment: DependencyEnvironment;
    reachability: DependencyReachability;
};
