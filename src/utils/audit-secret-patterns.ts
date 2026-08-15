/**
 * Shared secret redaction patterns for audit logging and journey scripts.
 * Centralized to avoid divergence between server-side and script-side redaction.
 */

export const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\bsk-[A-Za-z0-9]{20,}/gi,
  /\bghp_[A-Za-z0-9]{36}/gi,
  /\bgho_[A-Za-z0-9]{36}/gi,
  /\bglpat-[A-Za-z0-9\-]{20,}/gi,
  /\bxox[baprs]-[A-Za-z0-9\-]+/gi,
  /AIza[A-Za-z0-9\-_]{35}/gi,
];

export const REDACTED = '[REDACTED]';

/** Strip known secret patterns from a string value. */
export function redactSecrets(value: string): string {
  let result = value;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, REDACTED);
  }
  return result;
}
