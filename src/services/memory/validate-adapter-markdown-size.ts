/**
 * Train/tune safety: reject pathological Markdown (one-line blobs, huge files).
 * Limits come from {@link getAdapterMarkdownSizeLimits} / config env vars.
 */

import { getAdapterMarkdownSizeLimits } from '../../config/adapter-markdown-size-limits.js';


export interface ValidateAdapterMarkdownSizeOptions {
  /** When false, skip the full-document line count check (layer body updates). Default true. */
  enforceMaxLineCount?: boolean;
}

export type ValidateAdapterMarkdownSizeResult =
  | { ok: true }
  | {
      ok: false;
      code: string;
      message: string;
      details: Record<string, unknown>;
    };

function sliceLine(content: string, lineStart: number, i: number): string {
  return content.slice(lineStart, i);
}

/**
 * Validates adapter Markdown (or similar UTF-8 text) before store.
 * Uses a single pass over `content` after a cheap total-byte check.
 */
export function validateAdapterMarkdownSize(
  content: string,
  options?: ValidateAdapterMarkdownSizeOptions
): ValidateAdapterMarkdownSizeResult {
  const limits = getAdapterMarkdownSizeLimits();
  const enforceLineCount = options?.enforceMaxLineCount !== false;
  const totalBytes = Buffer.byteLength(content, 'utf8');
  if (totalBytes > limits.maxTotalBytes) {
    return {
      ok: false,
      code: 'ADAPTER_MARKDOWN_TOTAL_BYTES_EXCEEDED',
      message: `Adapter markdown exceeds maximum total size (${limits.maxTotalBytes} UTF-8 bytes, got ${totalBytes}).`,
      details: {
        max_total_bytes: limits.maxTotalBytes,
        total_bytes: totalBytes,
        max_lines: limits.maxLines,
        max_line_bytes: limits.maxLineBytes,
        safety_factor: limits.safetyFactor
      }
    };
  }

  let lineStart = 0;
  let lineIndex = 0;
  const len = content.length;

  for (let i = 0; i <= len; i++) {
    const atEnd = i === len;
    const c = atEnd ? -1 : content.charCodeAt(i);
    const isLf = c === 10;
    const isCr = c === 13;

    if (!atEnd && !isLf && !isCr) {
      continue;
    }

    const line = sliceLine(content, lineStart, i);
    const lineBytes = Buffer.byteLength(line, 'utf8');
    if (lineBytes > limits.maxLineBytes) {
      return {
        ok: false,
        code: 'ADAPTER_MARKDOWN_LINE_TOO_LONG',
        message: `Line ${lineIndex + 1} exceeds maximum UTF-8 length (${limits.maxLineBytes} bytes, got ${lineBytes}).`,
        details: {
          line_index: lineIndex,
          line_bytes: lineBytes,
          max_line_bytes: limits.maxLineBytes
        }
      };
    }

    lineIndex++;
    if (enforceLineCount && lineIndex > limits.maxLines) {
      return {
        ok: false,
        code: 'ADAPTER_MARKDOWN_LINE_COUNT_EXCEEDED',
        message: `Adapter markdown exceeds maximum line count (${limits.maxLines} lines, saw at least ${lineIndex}).`,
        details: {
          line_count_at_least: lineIndex,
          max_lines: limits.maxLines
        }
      };
    }

    if (atEnd) {
      break;
    }

    if (isCr && i + 1 < len && content.charCodeAt(i + 1) === 10) {
      i++;
    }
    lineStart = i + 1;
  }

  return { ok: true };
}

/** Artifact bodies: total-byte ceiling only (same as markdown composite cap). */
export function validateArtifactContentSize(content: string): ValidateAdapterMarkdownSizeResult {
  const limits = getAdapterMarkdownSizeLimits();
  const totalBytes = Buffer.byteLength(content, 'utf8');
  if (totalBytes > limits.maxTotalBytes) {
    return {
      ok: false,
      code: 'ARTIFACT_CONTENT_TOTAL_BYTES_EXCEEDED',
      message: `Artifact content exceeds maximum size (${limits.maxTotalBytes} UTF-8 bytes, got ${totalBytes}).`,
      details: {
        max_total_bytes: limits.maxTotalBytes,
        total_bytes: totalBytes
      }
    };
  }
  return { ok: true };
}
