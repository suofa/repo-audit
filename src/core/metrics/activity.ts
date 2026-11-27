import type { ActivityReport, AuthorStat, Commit, WeekBucket } from '../../types.ts';

const DEFAULT_WEEKS = 12;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Monday-based start of week, in local time. */
export function startOfWeek(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (day.getDay() + 6) % 7; // Sunday -> 6, Monday -> 0
  day.setDate(day.getDate() - offset);
  return day;
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysBetween(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / MS_PER_DAY);
}

/** Smallest number of authors that together own at least 60% of the commits. */
export function computeBusFactor(authors: AuthorStat[]): number {
  if (authors.length === 0) return 0;
  const total = authors.reduce((sum, author) => sum + author.commits, 0);
  if (total === 0) return 0;

  let covered = 0;
  for (let i = 0; i < authors.length; i += 1) {
    covered += authors[i].commits;
    if (covered / total >= 0.6) return i + 1;
  }
  return authors.length;
}

/** Groups commits by author e-mail so that renamed accounts stay together. */
export function computeAuthors(commits: Commit[]): AuthorStat[] {
  const byEmail = new Map<string, { name: string; commits: number }>();

  for (const commit of commits) {
    const key = commit.email.toLowerCase() || commit.author.toLowerCase();
    const existing = byEmail.get(key);
    if (existing) {
      existing.commits += 1;
    } else {
      byEmail.set(key, { name: commit.author, commits: 1 });
    }
  }

  const total = commits.length || 1;
  return [...byEmail.values()]
    .map((entry) => ({ name: entry.name, commits: entry.commits, share: entry.commits / total }))
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
}

export function buildActivity(commits: Commit[], options: { weeks?: number; now?: Date } = {}): ActivityReport {
  const weeks = options.weeks ?? DEFAULT_WEEKS;
  const now = options.now ?? new Date();

  if (commits.length === 0) {
    return {
      totalCommits: 0,
      commitsLast30: 0,
      commitsLast90: 0,
      firstCommit: null,
      lastCommit: null,
      activeDays: 0,
      weekly: buildEmptyWeeks(weeks, now),
      authors: [],
      busFactor: 0,
    };
  }

  let first = commits[0].date;
  let last = commits[0].date;
  const activeDays = new Set<string>();
  let commitsLast30 = 0;
  let commitsLast90 = 0;

  for (const commit of commits) {
    if (commit.date < first) first = commit.date;
    if (commit.date > last) last = commit.date;
    activeDays.add(toIsoDate(commit.date));

    const age = daysBetween(commit.date, now);
    if (age >= 0 && age <= 30) commitsLast30 += 1;
    if (age >= 0 && age <= 90) commitsLast90 += 1;
  }

  const authors = computeAuthors(commits);
  return {
    totalCommits: commits.length,
    commitsLast30,
    commitsLast90,
    firstCommit: first.toISOString(),
    lastCommit: last.toISOString(),
    activeDays: activeDays.size,
    weekly: buildWeekly(commits, weeks, now),
    authors,
    busFactor: computeBusFactor(authors),
  };
}

function buildEmptyWeeks(weeks: number, now: Date): WeekBucket[] {
  const current = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(current);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ weekStart: toIsoDate(start), commits: 0 });
  }
  return buckets;
}

function buildWeekly(commits: Commit[], weeks: number, now: Date): WeekBucket[] {
  const buckets = buildEmptyWeeks(weeks, now);
  const index = new Map(buckets.map((bucket, i) => [bucket.weekStart, i]));

  for (const commit of commits) {
    const key = toIsoDate(startOfWeek(commit.date));
    const position = index.get(key);
    if (position !== undefined) buckets[position].commits += 1;
  }

  return buckets;
}
