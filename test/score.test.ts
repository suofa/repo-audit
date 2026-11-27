import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildCommitQuality } from '../src/core/metrics/commit-quality.ts';
import { gradeFor, scoreScan } from '../src/core/score.ts';
import { scanRepository } from '../src/core/scan.ts';
import { makeHealthyRepo } from './helpers.ts';
import type { Commit } from '../src/types.ts';

function commit(subject: string): Commit {
  return { hash: String(Math.random()), author: 'A', email: 'a@example.com', date: new Date(), subject };
}

test('conventional commits are recognised', () => {
  const report = buildCommitQuality([
    commit('feat(api): add pagination'),
    commit('fix: crash on empty input'),
    commit('update stuff'),
    commit('.'),
  ]);

  assert.equal(report.total, 4);
  assert.equal(report.conventional, 2);
  assert.equal(report.conventionalRatio, 0.5);
  assert.equal(report.lazyMessages, 2);
  assert.equal(report.lazyRatio, 0.5);
});

test('empty history does not divide by zero', () => {
  const report = buildCommitQuality([]);
  assert.equal(report.total, 0);
  assert.equal(report.avgSubjectLength, 0);
  assert.equal(report.conventionalRatio, 0);
});

test('grades follow the documented thresholds', () => {
  assert.equal(gradeFor(95), 'A+');
  assert.equal(gradeFor(85), 'A');
  assert.equal(gradeFor(75), 'B');
  assert.equal(gradeFor(65), 'C');
  assert.equal(gradeFor(55), 'D');
  assert.equal(gradeFor(10), 'F');
});

test('scanning a healthy repository scores its hygiene as perfect', () => {
  const repo = makeHealthyRepo();
  try {
    const result = scanRepository(repo.dir, { now: new Date() });
    const score = scoreScan(result);

    assert.equal(result.target.name.length > 0, true);
    assert.equal(result.hygiene.checks.every((check) => check.ok), true);
    assert.equal(result.size.fileCount, 9);
    assert.equal(result.activity.totalCommits, 1);

    const hygiene = score.dimensions.find((dimension) => dimension.key === 'hygiene');
    assert.equal(hygiene?.score, 100);
    assert.equal(score.dimensions.every((dimension) => dimension.score >= 0 && dimension.score <= 100), true);
    assert.equal(score.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0), 1);
  } finally {
    repo.cleanup();
  }
});

test('a directory without git is rejected with a clear error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'repo-audit-plain-'));
  try {
    assert.throws(() => scanRepository(dir), /not a git repository/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
