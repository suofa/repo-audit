import type { ExtensionStat, FileStat, SizeReport } from '../../types.ts';
import type { FileSample } from '../files.ts';

const DEFAULT_TOP = 10;

/** Groups files by extension and keeps the heaviest files, so a reader can see where the bulk lives. */
export function buildSize(samples: FileSample[], options: { top?: number } = {}): SizeReport {
  const top = options.top ?? DEFAULT_TOP;
  const extensions = new Map<string, ExtensionStat>();

  let totalLines = 0;
  let totalBytes = 0;
  let binaryFiles = 0;

  for (const sample of samples) {
    totalBytes += sample.bytes;
    if (sample.binary) binaryFiles += 1;
    totalLines += sample.lines;

    const ext = extensionOf(sample.path);
    const entry = extensions.get(ext);
    if (entry) {
      entry.files += 1;
      entry.lines += sample.lines;
    } else {
      extensions.set(ext, { ext, files: 1, lines: sample.lines });
    }
  }

  const byExtension = [...extensions.values()].sort((a, b) => b.lines - a.lines || b.files - a.files);

  const largestFiles: FileStat[] = samples
    .filter((sample) => sample.lines > 0)
    .map((sample) => ({ path: sample.path, lines: sample.lines, bytes: sample.bytes }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, top);

  return {
    fileCount: samples.length,
    totalLines,
    totalBytes,
    binaryFiles,
    byExtension,
    largestFiles,
  };
}

/** `src/app.ts` -> `ts`, `Makefile` -> `no-ext`. */
export function extensionOf(path: string): string {
  const name = path.split('/').pop() ?? path;
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return 'no-ext';
  return name.slice(dot + 1).toLowerCase();
}
