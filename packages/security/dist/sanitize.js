/**
 * Minimal, deterministic HTML escaping for values that should be inserted into
 * HTML attribute or text contexts. This is used when the output destination is
 * not a JSX tree (e.g., string-based template replacement).
 */
export function escapeHtml(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/**
 * Escape a string for safe insertion inside a JavaScript string literal inside
 * an HTML <script> block. This does NOT make untrusted data safe for arbitrary
 * script execution; it only prevents breaking out of a JSON/string literal.
 */
export function escapeJsString(input) {
    return JSON.stringify(input).slice(1, -1);
}
/**
 * Serialize a value to JSON that is safe to embed inside an HTML <script> tag.
 * Escapes '<' to \u003c so that </script> inside the data cannot close the tag.
 */
export function escapeJsonForScript(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}
/**
 * Escape a string for safe insertion inside an HTML attribute. The caller is
 * responsible for quoting attributes with double quotes.
 */
export function escapeHtmlAttribute(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
/**
 * Sanitize external website-derived HTML so it can be treated as a data-only
 * string in analysis outputs. Used for prompt-boundary separation, not as a
 * browser-XSS sanitizer (rendered output must be escaped/sanitized separately).
 */
export function sanitizeExternalHtml(html) {
    return html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, 'blocked:')
        .trim();
}
