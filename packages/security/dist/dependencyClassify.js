// Packages that are only used at build/dev time and are not present in production runtime.
export const BUILD_TOOLS = new Set([
    'vitest', 'vite', 'vite-node', 'esbuild', '@vitejs/plugin-react', '@vitest/ui',
    '@vitest/coverage-v8', '@vitest/mocker', 'tailwindcss', 'postcss', 'autoprefixer',
]);
// Packages known to process untrusted network input at runtime.
export const NETWORK_REACHABLE = new Set([
    'qs', 'cookie', 'body-parser', 'raw-body', 'express', 'multer', 'busboy',
]);
export function classifyNpmDependency(input) {
    const { packageName, nodes = [], isDev } = input;
    // Treat build-only tooling as not reachable, regardless of where it appears.
    if (BUILD_TOOLS.has(packageName)) {
        return { environment: 'BUILD', reachability: 'NOT_REACHABLE' };
    }
    // If every installed node is a dev dependency, the package is dev-only.
    const allDev = isDev ?? (nodes.length > 0 && nodes.every((n) => n.includes('node_modules') && !n.startsWith('apps/')));
    if (allDev) {
        return { environment: 'DEV', reachability: 'NOT_REACHABLE' };
    }
    if (NETWORK_REACHABLE.has(packageName)) {
        return { environment: 'RUNTIME', reachability: 'REACHABLE' };
    }
    return { environment: 'RUNTIME', reachability: 'UNKNOWN' };
}
