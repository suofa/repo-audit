import { spawnSync } from 'node:child_process';
import type { Commit } from '../types.ts';

/** Raised when a git sub-process exits with a non-zero status. */
export class GitError extends Error {
  readonly args: string[];
  readonly stderr: string;

  constructor(args: string[], stderr: string) {
    super(`git ${args.join(' ')} failed: ${stderr.trim()}`);
    this.name = 'GitError';
    this.args = args;
    this.stderr = stderr;
  }
}

const MAX_BUFFER = 128 * 1024 * 1024;

function run(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
    encoding: 'utf8',
  });

  if (result.error) {
    const err = result.error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error('git is not installed or not on PATH. Install git first: https://git-scm.com/downloads');
    }
    throw err;
  }
  if (result.status !== 0) {
    throw new GitError(args, result.stderr ?? '');
  }
  return result.stdout ?? '';
}

export function runGit(cwd: string, args: string[]): string {
  return run(cwd, args);
}

export function isGitRepo(dir: string): boolean {
  try {
    return run(dir, ['rev-parse', '--is-inside-work-tree']).trim() === 'true';
  } catch {
    return false;
  }
}

export function repoRoot(dir: string): string {
  return run(dir, ['rev-parse', '--show-toplevel']).trim();
}

const FIELD = '\x1f';
const RECORD = '\x1e';

/**
 * Reads the commit log. Merges are skipped on purpose: a merge commit carries no
 * intent of its own and would double-count the work of the branch it brings in.
 */
export function listCommits(dir: string, maxCommits = 5000): Commit[] {
  const format = ['%H', '%an', '%ae', '%aI', '%s'].join(FIELD) + RECORD;
  const raw = run(dir, ['log', `--max-count=${maxCommits}`, '--no-merges', `--pretty=format:${format}`]);

  const commits: Commit[] = [];
  for (const record of raw.split(RECORD)) {
    const line = record.replace(/^\r?\n/, '');
    if (!line) continue;
    const [hash, author, email, date, subject] = line.split(FIELD);
    if (!hash || !date) continue;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) continue;
    commits.push({
      hash,
      author: author ?? 'unknown',
      email: email ?? '',
      date: parsed,
      subject: subject ?? '',
    });
  }
  return commits;
}

/** Tracked files only: untracked scratch files should not influence the score. */
export function listFiles(dir: string): string[] {
  const raw = run(dir, ['ls-files', '-z']);
  return raw.split('\0').filter((entry) => entry.length > 0);
}

/** Returns true when the repository has at least one commit. */
export function hasCommits(dir: string): boolean {
  try {
    run(dir, ['rev-parse', '--verify', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}
