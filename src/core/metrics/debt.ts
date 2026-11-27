import type { DebtReport, MarkerCount } from '../../types.ts';
import type { FileSample } from '../files.ts';

const DEFAULT_TOP = 5;
const BIG_FILE_LINES = 400;

const MARKERS: { kind: string; pattern: RegExp }[] = [
  { kind: 'TODO', pattern: /\bTODO\b/g },
  { kind: 'FIXME', pattern: /\bFIXME\b/g },
  { kind: 'HACK', pattern: /\bHACK\b/g },
  { kind: 'XXX', pattern: /\bXXX\b/g },
];

/**
 * Counts explicit debt markers and oversized files. Only text files that were
 * read into memory are scanned, so huge bundles never skew the numbers.
 */
export function buildDebt(samples: FileSample[], totalLines: number, options: { top?: number } = {}): DebtReport {
  const top = options.top ?? DEFAULT_TOP;
  const markers: MarkerCount[] = MARKERS.map(({ kind }) => ({ kind, count: 0 }));
  const markerByKind = new Map(markers.map((marker) => [marker.kind, marker]));
  const perFile: { path: string; count: number }[] = [];
  let markerCount = 0;

  for (const sample of samples) {
    if (!sample.text) continue;

    let fileCount = 0;
    for (const { kind, pattern } of MARKERS) {
      // A fresh regex per file keeps lastIndex from leaking between files.
      const matches = sample.text.match(new RegExp(pattern.source, 'g'));
      if (!matches) continue;
      const entry = markerByKind.get(kind);
      if (entry) entry.count += matches.length;
      fileCount += matches.length;
    }

    if (fileCount > 0) {
      markerCount += fileCount;
      perFile.push({ path: sample.path, count: fileCount });
    }
  }

  const topFiles = perFile.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)).slice(0, top);

  const bigFiles = samples
    .filter((sample) => sample.lines > BIG_FILE_LINES)
    .map((sample) => ({ path: sample.path, lines: sample.lines }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, top);

  return {
    markerCount,
    markers: markers.filter((marker) => marker.count > 0),
    topFiles,
    density: totalLines > 0 ? (markerCount / totalLines) * 1000 : 0,
    bigFiles,
  };
}
