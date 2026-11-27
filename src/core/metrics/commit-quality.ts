import type { Commit, CommitQualityReport } from '../../types.ts';

/** Conventional Commits: `feat(scope)!: subject`. */
const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w.\-/]+\))?!?:\s+\S/;

/** Messages that tell a reviewer nothing about the change. */
const LAZY = new Set([
  '.',
  '..',
  'wip',
  'test',
  'update',
  'updates',
  'fix',
  'fixes',
  'fixed',
  'commit',
  'change',
  'changes',
  'init',
  'initial',
  'first commit',
  '修改',
  '更新',
  '提交',
  '修复',
  '完成',
]);

/** "update stuff" / "fix bug": starts with a lazy verb and says nothing more. */
const LAZY_VERB = /^(update|updates|fix|fixes|fixed|change|changes|modify|modified|add|added|remove|removed|test|commit|修改|更新|提交|修复)\b/i;
const LAZY_MAX_LENGTH = 25;

export function buildCommitQuality(commits: Commit[]): CommitQualityReport {
  const total = commits.length;
  if (total === 0) {
    return {
      total: 0,
      conventional: 0,
      conventionalRatio: 0,
      lazyMessages: 0,
      lazyRatio: 0,
      avgSubjectLength: 0,
    };
  }

  let conventional = 0;
  let lazyMessages = 0;
  let subjectLength = 0;

  for (const commit of commits) {
    const subject = commit.subject.trim();
    subjectLength += subject.length;
    if (CONVENTIONAL.test(subject)) conventional += 1;
    if (isLazy(subject)) lazyMessages += 1;
  }

  return {
    total,
    conventional,
    conventionalRatio: conventional / total,
    lazyMessages,
    lazyRatio: lazyMessages / total,
    avgSubjectLength: subjectLength / total,
  };
}

function isLazy(subject: string): boolean {
  const normalised = subject.toLowerCase().replace(/[!。！\s]+$/, '');
  if (normalised.length <= 2) return true;
  if (LAZY.has(normalised)) return true;
  if (CONVENTIONAL.test(subject)) return false;
  if (LAZY_VERB.test(normalised) && normalised.length <= LAZY_MAX_LENGTH) return true;
  // A single short word such as "readme" still says nothing about the change.
  return normalised.length < 8 && !/\s/.test(normalised);
}
