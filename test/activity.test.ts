import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildActivity, computeBusFactor, startOfWeek, toIsoDate } from '../src/core/metrics/activity.ts';
import type { Commit } from '../src/types.ts';

function commit(daysAgo: number, from: Date, author = 'Alice', email = 'alice@example.com'): Commit {
  const date = new Date(from.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return { hash: String(Math.random()), author, email, date, subject: 'feat: something' };
}

test('startOfWeek returns the Monday of the same week', () => {
  // 2026-06-17 is a Wednesday.
  const monday = startOfWeek(new Date(2026, 5, 17));
  assert.equal(toIsoDate(monday), '2026-06-15');
  // A Monday maps to itself.
  assert.equal(toIsoDate(startOfWeek(new Date(2026, 5, 15))), '2026-06-15');
});

test('buildActivity counts commits inside the 30 and 90 day windows', () => {
  const now = new Date(2026, 5, 15, 12);
  const commits = [commit(1, now), commit(10, now), commit(45, now), commit(120, now)];

  const activity = buildActivity(commits, { now, weeks: 12 });

  assert.equal(activity.totalCommits, 4);
  assert.equal(activity.commitsLast30, 2);
  assert.equal(activity.commitsLast90, 3);
  assert.equal(activity.activeDays, 4);
  assert.equal(activity.weekly.length, 12);
});

test('buildActivity returns an empty but well-formed report for an empty history', () => {
  const activity = buildActivity([], { now: new Date(2026, 5, 15), weeks: 4 });

  assert.equal(activity.totalCommits, 0);
  assert.equal(activity.firstCommit, null);
  assert.equal(activity.weekly.length, 4);
  assert.equal(activity.weekly.every((bucket) => bucket.commits === 0), true);
});

test('weekly buckets place commits in the right week', () => {
  const now = new Date(2026, 5, 15, 12);
  const activity = buildActivity([commit(0, now), commit(0, now), commit(7, now)], { now, weeks: 4 });

  assert.equal(activity.weekly.at(-1)?.commits, 2);
  assert.equal(activity.weekly.at(-2)?.commits, 1);
});

test('computeBusFactor is 1 when one author owns most commits', () => {
  const authors = [
    { name: 'Alone', commits: 9, share: 0.9 },
    { name: 'Other', commits: 1, share: 0.1 },
  ];
  assert.equal(computeBusFactor(authors), 1);
});

test('computeBusFactor grows when work is spread out', () => {
  const authors = [
    { name: 'A', commits: 4, share: 0.4 },
    { name: 'B', commits: 3, share: 0.3 },
    { name: 'C', commits: 3, share: 0.3 },
  ];
  assert.equal(computeBusFactor(authors), 2);
});

test('authors are grouped by e-mail, not by display name', () => {
  const now = new Date(2026, 5, 15);
  const commits = [commit(1, now, 'Alice', 'a@example.com'), commit(2, now, 'alice (laptop)', 'a@example.com')];

  const activity = buildActivity(commits, { now });
  assert.equal(activity.authors.length, 1);
  assert.equal(activity.authors[0].commits, 2);
});
