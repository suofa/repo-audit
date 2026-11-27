import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHygiene } from '../src/core/metrics/hygiene.ts';
import { buildDebt } from '../src/core/metrics/debt.ts';
import { extensionOf, buildSize } from '../src/core/metrics/size.ts';
import type { FileSample } from '../src/core/files.ts';

function sample(path: string, text: string | null = null, lines = 1): FileSample {
  return { path, bytes: text?.length ?? 0, lines, binary: text === null, text, truncated: false };
}

test('a well-equipped repository passes the core hygiene checks', () => {
  const files = [
    'README.md',
    'LICENSE',
    '.gitignore',
    '.github/workflows/ci.yml',
    'test/demo.test.ts',
    'package.json',
    'src/index.ts',
  ];
  const samples = files.map((file) => sample(file, file === 'LICENSE' ? 'MIT License\nCopyright 2026' : null));

  const report = buildHygiene(files, samples);
  const byId = new Map(report.checks.map((check) => [check.id, check]));

  assert.equal(byId.get('readme')?.ok, true);
  assert.equal(byId.get('license')?.ok, true);
  assert.equal(byId.get('ci')?.ok, true);
  assert.equal(byId.get('tests')?.ok, true);
  assert.equal(byId.get('manifest')?.ok, true);
  assert.equal(report.licenseName, 'MIT');
  assert.equal(report.ciFiles, 1);
});

test('a bare repository fails everything that matters', () => {
  const report = buildHygiene(['main.py'], [sample('main.py', 'print(1)')]);
  const failing = report.checks.filter((check) => !check.ok).map((check) => check.id);

  assert.deepEqual(failing.sort(), ['changelog', 'ci', 'docs', 'gitignore', 'license', 'manifest', 'readme', 'tests']);
  assert.equal(report.licenseName, null);
});

test('license detection understands the common licences', () => {
  const cases: [string, string][] = [
    ['Apache License\nVersion 2.0', 'Apache-2.0'],
    ['GNU GENERAL PUBLIC LICENSE\nVersion 3', 'GPL-3.0'],
    ['BSD 3-Clause License', 'BSD-3-Clause'],
  ];

  for (const [text, expected] of cases) {
    const report = buildHygiene(['LICENSE'], [sample('LICENSE', text)]);
    assert.equal(report.licenseName, expected);
  }
});

test('debt counts markers and computes density per 1000 lines', () => {
  const samples = [
    sample('a.ts', '// TODO: one\n// FIXME: two\n', 2),
    sample('b.ts', 'const x = 1; // TODO\n', 1),
  ];

  const report = buildDebt(samples, 1000);
  assert.equal(report.markerCount, 3);
  assert.equal(report.density, 3);
  assert.equal(report.topFiles[0].count, 2);
  assert.deepEqual(report.markers.map((marker) => marker.kind).sort(), ['FIXME', 'TODO']);
});

test('debt ignores binary files and flags oversized ones', () => {
  const samples = [sample('big.ts', null, 900), sample('img.png', null, 0)];
  const report = buildDebt(samples, 900);

  assert.equal(report.markerCount, 0);
  assert.equal(report.bigFiles.length, 1);
  assert.equal(report.bigFiles[0].path, 'big.ts');
});

test('extensionOf handles dotfiles and extension-less files', () => {
  assert.equal(extensionOf('src/app.ts'), 'ts');
  assert.equal(extensionOf('Makefile'), 'no-ext');
  assert.equal(extensionOf('.gitignore'), 'no-ext');
  assert.equal(extensionOf('a/b/c.TS'), 'ts');
});

test('size groups files by extension and keeps the biggest', () => {
  const samples = [
    sample('src/a.ts', 'x', 10),
    sample('src/b.ts', 'x', 30),
    sample('README.md', 'x', 5),
  ];

  const report = buildSize(samples, { top: 2 });
  assert.equal(report.fileCount, 3);
  assert.equal(report.totalLines, 45);
  assert.equal(report.byExtension[0].ext, 'ts');
  assert.equal(report.byExtension[0].files, 2);
  assert.equal(report.largestFiles[0].path, 'src/b.ts');
  assert.equal(report.largestFiles.length, 2);
});
