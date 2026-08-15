/**
 * MCP audit summary helpers.
 *
 * Prepare sanitized, bounded request/response snapshots for the audit side-stream
 * at configurable verbosity levels (AUDIT_LOG_LEVEL 0-3).
 *
 * These helpers are called from the MCP HTTP handler after a tool call completes.
 * They never throw; on unexpected input they return a minimal safe record.
 */

import { redactSecrets } from './audit-secret-patterns.js';

const MAX_SUMMARY_DEPTH = 6;
const MAX_SUMMARY_KEYS = 50;
const MAX_SUMMARY_STRING_LEN = 2_048;
const MAX_SUMMARY_ARRAY_ITEMS = 50;

/** Recursively sanitize a value for audit output (depth-bounded, key-bounded, string-capped). */
function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_SUMMARY_DEPTH) return '[max depth]';
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const capped = value.length > MAX_SUMMARY_STRING_LEN
      ? value.slice(0, MAX_SUMMARY_STRING_LEN) + '...[truncated]'
      : value;
    return redactSecrets(capped);
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name || 'Error', message: redactSecrets(value.message || '') };
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_SUMMARY_ARRAY_ITEMS).map((v) => sanitizeValue(v, depth + 1));
    if (value.length > MAX_SUMMARY_ARRAY_ITEMS) {
      // Wrap with metadata to preserve array semantics in JSON (plan: _truncated flag)
      return { items, _truncated: true, _original_count: value.length };
    }
    return items;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const limit = Math.min(entries.length, MAX_SUMMARY_KEYS);
    const out: Record<string, unknown> = {};
    for (let i = 0; i < limit; i++) {
      const [k, v] = entries[i]!;
      out[k] = sanitizeValue(v, depth + 1);
    }
    if (entries.length > MAX_SUMMARY_KEYS) {
      out['_omitted_key_count'] = entries.length - MAX_SUMMARY_KEYS;
    }
    return out;
  }
  return String(value);
}

/**
 * Sanitize request arguments for audit level 2+.
 * Applies tool-specific summarization for large payloads (e.g. train content).
 */
export function summarizeRequestArgs(toolName: string, args: unknown): Record<string, unknown> {
  try {
    if (!args || typeof args !== 'object') return {};
    const raw = args as Record<string, unknown>;

    // Tool-specific summarization for large payloads
    if (toolName === 'train') {
      const summary: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (k === 'content' || k === 'markdown') {
          // At level 2, include length and metadata only (not raw content)
          summary[`${k}_length`] = typeof v === 'string' ? v.length : 0;
          // Pass through non-content fields normally
        } else {
          summary[k] = sanitizeValue(v, 1);
        }
      }
      return summary;
    }

    return sanitizeValue(raw, 1) as Record<string, unknown>;
  } catch {
    return { _error: 'summarize_request_failed' };
  }
}

/**
 * Sanitize tool response for audit level 3.
 * Captures the full response content array (bounded).
 */
export function summarizeResponse(toolName: string, result: unknown): Record<string, unknown> {
  try {
    if (!result || typeof result !== 'object') return { raw: sanitizeValue(result, 1) };
    const raw = result as Record<string, unknown>;

    // MCP tool results have { content: [{type, text}], isError?: boolean }
    if (Array.isArray(raw['content'])) {
      const summary: Record<string, unknown> = {
        isError: raw['isError'] === true,
      };
      const contentItems = (raw['content'] as unknown[]).slice(0, MAX_SUMMARY_ARRAY_ITEMS);
      summary['content'] = contentItems.map((item) => {
        if (item && typeof item === 'object') {
          const entry = item as Record<string, unknown>;
          const out: Record<string, unknown> = { type: entry['type'] ?? 'unknown' };
          if (typeof entry['text'] === 'string') {
            out['text'] = redactSecrets(
              (entry['text'] as string).slice(0, MAX_SUMMARY_STRING_LEN)
            );
            if ((entry['text'] as string).length > MAX_SUMMARY_STRING_LEN) {
              out['_text_truncated'] = true;
            }
          }
          return out;
        }
        return sanitizeValue(item, 2);
      });
      if ((raw['content'] as unknown[]).length > MAX_SUMMARY_ARRAY_ITEMS) {
        summary['_content_truncated'] = true;
      }
      return summary;
    }

    return sanitizeValue(raw, 1) as Record<string, unknown>;
  } catch {
    return { _error: 'summarize_response_failed' };
  }
}

/**
 * Extract an error_code from a tool result if present.
 * Looks at common error_code locations in MCP tool results.
 */
export function extractErrorCode(result: unknown): string | undefined {
  try {
    if (!result || typeof result !== 'object') return undefined;
    const raw = result as Record<string, unknown>;

    // Direct error_code field
    if (typeof raw['error_code'] === 'string') return raw['error_code'];

    // MCP error result: { content: [{type:'text', text: JSON with error_code}] }
    if (raw['isError'] === true && Array.isArray(raw['content'])) {
      const first = (raw['content'] as unknown[])[0];
      if (first && typeof first === 'object') {
        const text = (first as Record<string, unknown>)['text'];
        if (typeof text === 'string') {
          try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            if (typeof parsed['error_code'] === 'string') return parsed['error_code'];
            const data = parsed['data'] as Record<string, unknown> | undefined;
            if (data && typeof data['error_code'] === 'string') return data['error_code'];
          } catch {
            // Not JSON; try regex extraction
            const match = text.match(/"error_code"\s*:\s*"([^"]+)"/);
            if (match?.[1]) return match[1];
          }
        }
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}
