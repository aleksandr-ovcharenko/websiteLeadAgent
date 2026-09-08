/**
 * Minimal, deterministic HTML escaping for values that should be inserted into
 * HTML attribute or text contexts. This is used when the output destination is
 * not a JSX tree (e.g., string-based template replacement).
 */
export declare function escapeHtml(input: string): string;
/**
 * Escape a string for safe insertion inside a JavaScript string literal inside
 * an HTML <script> block. This does NOT make untrusted data safe for arbitrary
 * script execution; it only prevents breaking out of a JSON/string literal.
 */
export declare function escapeJsString(input: string): string;
/**
 * Serialize a value to JSON that is safe to embed inside an HTML <script> tag.
 * Escapes '<' to \u003c so that </script> inside the data cannot close the tag.
 */
export declare function escapeJsonForScript(value: unknown): string;
/**
 * Escape a string for safe insertion inside an HTML attribute. The caller is
 * responsible for quoting attributes with double quotes.
 */
export declare function escapeHtmlAttribute(input: string): string;
/**
 * Sanitize external website-derived HTML so it can be treated as a data-only
 * string in analysis outputs. Used for prompt-boundary separation, not as a
 * browser-XSS sanitizer (rendered output must be escaped/sanitized separately).
 */
export declare function sanitizeExternalHtml(html: string): string;
