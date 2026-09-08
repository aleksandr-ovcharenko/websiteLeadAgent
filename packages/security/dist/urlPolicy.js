import { isIP } from 'node:net';
import { resolve4, resolve6 } from 'node:dns/promises';
const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'metadata',
    'metadata.google.internal',
    'metadata.aws.internal',
]);
function isLoopbackIPv4(octs) {
    return octs[0] === 127;
}
function isLinkLocalIPv4(octs) {
    return octs[0] === 169 && octs[1] === 254;
}
function isPrivateIPv4(octs) {
    const [a, b] = octs;
    if (a === 10)
        return true;
    if (a === 172 && b >= 16 && b <= 31)
        return true;
    if (a === 192 && b === 168)
        return true;
    if (a === 100 && b >= 64 && b <= 127)
        return true; // CGNAT
    if (a === 192 && b === 0 && octs[2] === 0)
        return true; // IETF
    if (a === 192 && b === 0 && octs[2] === 2)
        return true; // TEST-NET-1
    if (a === 198 && (b === 18 || b === 19))
        return true; // TEST-NET-2/3
    if (a === 198 && b === 51 && octs[2] === 100)
        return true;
    if (a === 203 && b === 0 && octs[2] === 113)
        return true;
    if (a === 0)
        return true;
    if (a >= 224)
        return true; // multicast/experimental/reserved
    return false;
}
function isCloudMetadataIPv4(octs) {
    return octs[0] === 169 && octs[1] === 254;
}
function checkIPv4(ip) {
    const octs = ip.split('.').map(Number);
    if (octs.length !== 4 || octs.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
        return { allowed: false, reason: 'invalid_ipv4' };
    }
    if (isLoopbackIPv4(octs))
        return { allowed: false, reason: 'loopback_ipv4' };
    if (isCloudMetadataIPv4(octs) || isLinkLocalIPv4(octs))
        return { allowed: false, reason: 'link_local_ipv4' };
    if (isPrivateIPv4(octs))
        return { allowed: false, reason: 'private_ipv4' };
    return { allowed: true };
}
function expandIPv6(ip) {
    let full = ip;
    if (full.includes('::')) {
        const parts = full.split('::');
        if (parts.length !== 2)
            return null;
        const left = parts[0] ? parts[0].split(':') : [];
        const right = parts[1] ? parts[1].split(':') : [];
        const missing = 8 - (left.length + right.length);
        if (missing < 0)
            return null;
        const mid = Array(missing).fill('0');
        full = [...left, ...mid, ...right].join(':');
    }
    const groups = full.split(':');
    if (groups.length !== 8)
        return null;
    return groups.map((g) => (g || '0').toLowerCase().padStart(4, '0'));
}
function checkIPv6(ip) {
    const groups = expandIPv6(ip);
    if (!groups)
        return { allowed: false, reason: 'invalid_ipv6' };
    // Loopback ::1
    if (groups.every((g, i) => (i === 7 ? g === '0001' : g === '0000'))) {
        return { allowed: false, reason: 'loopback_ipv6' };
    }
    // Link-local fe80::/10
    const first = parseInt(groups[0], 16);
    if ((first & 0xffc0) === 0xfe80)
        return { allowed: false, reason: 'link_local_ipv6' };
    // Unique local fc00::/7
    if ((first & 0xfe00) === 0xfc00)
        return { allowed: false, reason: 'unique_local_ipv6' };
    // IPv4-mapped ::ffff:0:0/96 (groups 0-5 are 0000, 0000, 0000, 0000, 0000, ffff; groups 6-7 hold IPv4)
    if (groups.slice(0, 5).every((g) => g === '0000') && groups[5] === 'ffff') {
        const high = parseInt(groups[6], 16);
        const low = parseInt(groups[7], 16);
        const mapped = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        return checkIPv4(mapped);
    }
    return { allowed: true };
}
function isBlockedHost(hostname) {
    const h = hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(h))
        return true;
    if (h === 'metadata.google.internal' || h.endsWith('.metadata.google.internal'))
        return true;
    if (h === 'metadata.aws.internal' || h.endsWith('.metadata.aws.internal'))
        return true;
    if (h === 'metadata' || h.startsWith('metadata.'))
        return true;
    return false;
}
export async function isAllowedUrl(urlString) {
    let url;
    try {
        url = new URL(urlString);
    }
    catch {
        return { allowed: false, reason: 'invalid_url' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { allowed: false, reason: 'unsupported_scheme' };
    }
    const hostname = url.hostname;
    if (!hostname)
        return { allowed: false, reason: 'missing_host' };
    const ipType = isIP(hostname);
    if (ipType === 4) {
        return checkIPv4(hostname);
    }
    if (ipType === 6) {
        return checkIPv6(hostname);
    }
    if (isBlockedHost(hostname)) {
        return { allowed: false, reason: 'blocked_hostname' };
    }
    try {
        const [v4, v6] = await Promise.allSettled([
            resolve4(hostname),
            resolve6(hostname),
        ]);
        const addresses = [];
        if (v4.status === 'fulfilled')
            addresses.push(...v4.value);
        if (v6.status === 'fulfilled')
            addresses.push(...v6.value);
        if (addresses.length === 0) {
            return { allowed: false, reason: 'dns_resolution_failed' };
        }
        for (const addr of addresses) {
            const type = isIP(addr);
            if (type === 4) {
                const r = checkIPv4(addr);
                if (!r.allowed)
                    return { allowed: false, reason: `resolved_to_private_ipv4: ${addr}` };
            }
            else if (type === 6) {
                const r = checkIPv6(addr);
                if (!r.allowed)
                    return { allowed: false, reason: `resolved_to_private_ipv6: ${addr}` };
            }
        }
    }
    catch (err) {
        return { allowed: false, reason: 'dns_error' };
    }
    return { allowed: true };
}
export async function assertAllowedUrl(urlString) {
    const result = await isAllowedUrl(urlString);
    if (!result.allowed) {
        throw new Error(`SSRF policy violation: ${urlString} - ${result.reason || 'blocked'}`);
    }
}
export function isAllowedUrlSync(urlString, resolvedAddresses) {
    let url;
    try {
        url = new URL(urlString);
    }
    catch {
        return { allowed: false, reason: 'invalid_url' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { allowed: false, reason: 'unsupported_scheme' };
    }
    const hostname = url.hostname;
    const ipType = isIP(hostname);
    if (ipType === 4)
        return checkIPv4(hostname);
    if (ipType === 6)
        return checkIPv6(hostname);
    if (isBlockedHost(hostname))
        return { allowed: false, reason: 'blocked_hostname' };
    if (!resolvedAddresses.length)
        return { allowed: true };
    for (const addr of resolvedAddresses) {
        const type = isIP(addr);
        if (type === 4) {
            const r = checkIPv4(addr);
            if (!r.allowed)
                return { allowed: false, reason: `resolved_to_private_ipv4: ${addr}` };
        }
        else if (type === 6) {
            const r = checkIPv6(addr);
            if (!r.allowed)
                return { allowed: false, reason: `resolved_to_private_ipv6: ${addr}` };
        }
    }
    return { allowed: true };
}
