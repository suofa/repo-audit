import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface FileSample {
  /** Repository-relative path with forward slashes. */
  path: string;
  bytes: number;
  lines: number;
  binary: boolean;
  /** File body, present only for small text files. */
  text: string | null;
  /** True when the file was too large to read completely. */
  truncated: boolean;
}

export interface ReadOptions {
  /** Files larger than this are flagged binary (no line counting). */
  maxBytes?: number;
  /** Files larger than this keep their line count but drop the text body. */
  maxTextBytes?: number;
}

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_TEXT_BYTES = 1024 * 1024;

function looksBinary(buffer: Buffer): boolean {
  const probe = buffer.subarray(0, 8000);
  return probe.includes(0);
}

function countLines(buffer: Buffer): number {
  if (buffer.length === 0) return 0;
  let lines = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] === 10) lines += 1;
  }
  // A file that does not end with a newline still has a final line.
  if (buffer[buffer.length - 1] !== 10) lines += 1;
  return lines;
}

/**
 * Reads every tracked file once so that the size and debt metrics share the
 * same snapshot of the working tree.
 */
export function readTrackedFiles(root: string, paths: string[], options: ReadOptions = {}): FileSample[] {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxTextBytes = options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES;
  const samples: FileSample[] = [];

  for (const path of paths) {
    const absolute = join(root, path);
    let size: number;
    try {
      const stat = statSync(absolute);
      if (!stat.isFile()) continue;
      size = stat.size;
    } catch {
      continue; // deleted from the working tree but still tracked
    }

    if (size > maxBytes) {
      samples.push({ path, bytes: size, lines: 0, binary: true, text: null, truncated: true });
      continue;
    }

    let buffer: Buffer;
    try {
      buffer = readFileSync(absolute);
    } catch {
      continue;
    }

    const binary = looksBinary(buffer);
    const sample: FileSample = {
      path,
      bytes: buffer.length,
      lines: binary ? 0 : countLines(buffer),
      binary,
      text: !binary && buffer.length <= maxTextBytes ? buffer.toString('utf8') : null,
      truncated: false,
    };
    samples.push(sample);
  }

  return samples;
}
