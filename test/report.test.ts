import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { escapeHtml, renderHtml } from '../src/report/html.ts';
import { renderTerminal } from '../src/report/terminal.ts';
import { scoreScan } from '../src/core/score.ts';
import { scanRepository } from '../src/core/scan.ts';
import { makeHealthyRepo } from './helpers.ts';

test('escapeHtml neutralises markup in untrusted strings', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
});

test('html report is self-contained and escapes the project name', () => {
  const repo = makeHealthyRepo();
  try {
    const result = scanRepository(repo.dir);
    result.target.name = '<img src=x onerror=alert(1)>';
    const score = scoreScan(result);
    const html = renderHtml(result, score);

    assert.match(html, /<!doctype html>/i);
    assert.match(html, /<style>/);
    assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
    assert.equal(html.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
    assert.equal(html.includes('<link rel="stylesheet"'), false, 'stylesheet must be inline');
  } finally {
    repo.cleanup();
  }
});

test('terminal report renders every section without colour codes when disabled', () => {
  const repo = makeHealthyRepo();
  try {
    const result = scanRepository(repo.dir);
    const score = scoreScan(result);
    const text = renderTerminal(result, score, { color: false });

    assert.equal(text.includes('\u001b['), false);
    for (const section of ['维度得分', '活跃度', '代码规模', '工程规范', '技术债', '提交质量']) {
      assert.equal(text.includes(section), true, `missing section: ${section}`);
    }
  } finally {
    repo.cleanup();
  }
});

test('cli writes a JSON document and an HTML file, creating missing folders', () => {
  const repo = makeHealthyRepo();
  const reportPath = join(repo.dir, 'out', 'nested', 'report.html');
  try {
    const stdout = execFileSync(process.execPath, ['src/cli.ts', repo.dir, '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const parsed = JSON.parse(stdout) as { target: { name: string }; score: { total: number } };
    assert.equal(typeof parsed.target.name, 'string');
    assert.equal(parsed.score.total > 0, true);

    execFileSync(process.execPath, ['src/cli.ts', repo.dir, '--html', reportPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const html = readFileSync(reportPath, 'utf8');
    assert.match(html, /<!doctype html>/i);
  } finally {
    repo.cleanup();
  }
});

test('cli exits with 2 when the score is below --fail-under', () => {
  const repo = makeHealthyRepo();
  try {
    let code = 0;
    try {
      execFileSync(process.execPath, ['src/cli.ts', repo.dir, '--fail-under', '100', '--no-color'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
    } catch (error) {
      code = (error as { status?: number }).status ?? -1;
    }
    assert.equal(code, 2);
  } finally {
    repo.cleanup();
  }
});
