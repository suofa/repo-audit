import { isGitRepo, repoRoot, listCommits, listFiles, hasCommits } from './git.ts';
import { readTrackedFiles } from './files.ts';
import { buildActivity } from './metrics/activity.ts';
import { buildSize } from './metrics/size.ts';
import { buildHygiene } from './metrics/hygiene.ts';
import { buildDebt } from './metrics/debt.ts';
import { buildCommitQuality } from './metrics/commit-quality.ts';
import type { ScanOptions, ScanResult } from '../types.ts';

export class NotARepositoryError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`not a git repository (or any parent): ${path}`);
    this.name = 'NotARepositoryError';
    this.path = path;
  }
}

/**
 * Collects every metric for one repository. The working tree is read once and
 * reused by the size and debt metrics so both see the same snapshot.
 */
export function scanRepository(target: string, options: ScanOptions = {}): ScanResult {
  if (!isGitRepo(target)) throw new NotARepositoryError(target);

  const root = repoRoot(target);
  const top = options.top ?? 10;

  const commits = hasCommits(root) ? listCommits(root, options.maxCommits ?? 5000) : [];
  const files = listFiles(root);
  const samples = readTrackedFiles(root, files);

  const activity = buildActivity(commits, { weeks: options.weeks, now: options.now });
  const size = buildSize(samples, { top });
  const hygiene = buildHygiene(files, samples);
  const debt = buildDebt(samples, size.totalLines, { top });
  const commitQuality = buildCommitQuality(commits);

  return {
    target: {
      path: target,
      root,
      name: root.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? root,
    },
    generatedAt: (options.now ?? new Date()).toISOString(),
    activity,
    size,
    hygiene,
    debt,
    commitQuality,
  };
}
