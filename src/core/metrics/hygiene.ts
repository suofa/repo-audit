import type { HygieneCheck, HygieneReport } from '../../types.ts';
import type { FileSample } from '../files.ts';

const README = /^readme(\.[a-z]+)?$/i;
const LICENSE = /^(license|licence|copying)(\.[a-z]+)?$/i;
const CHANGELOG = /^(changelog|changes|history)(\.[a-z]+)?$/i;
const CONTRIBUTING = /^contributing(\.[a-z]+)?$/i;
const CI = /^\.github\/workflows\/[^/]+\.ya?ml$/i;
const TEST_PATH = /(^|\/)(__tests__|tests?|spec)\//i;
const TEST_FILE = /\.(test|spec)\.[a-z0-9]+$/i;
const MANIFESTS = new Set([
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'go.mod',
  'cargo.toml',
  'pom.xml',
  'build.gradle',
  'cmakelists.txt',
  'makefile',
]);

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

function licenseName(text: string | null): string | null {
  if (!text) return null;
  if (/MIT License/i.test(text)) return 'MIT';
  if (/Apache License/i.test(text)) return 'Apache-2.0';
  if (/GNU GENERAL PUBLIC LICENSE/i.test(text)) {
    if (/Version 3/i.test(text)) return 'GPL-3.0';
    if (/Version 2/i.test(text)) return 'GPL-2.0';
    return 'GPL';
  }
  if (/BSD 3-Clause/i.test(text)) return 'BSD-3-Clause';
  if (/BSD 2-Clause/i.test(text)) return 'BSD-2-Clause';
  if (/Mozilla Public License/i.test(text)) return 'MPL-2.0';
  if (/The Unlicense/i.test(text)) return 'Unlicense';
  return 'custom';
}

export function buildHygiene(files: string[], samples: FileSample[]): HygieneReport {
  const names = files.map(basename);
  const ciFiles = files.filter((path) => CI.test(path)).length;

  const has = (pattern: RegExp): boolean => names.some((name) => pattern.test(name));

  const testsPresent =
    files.some((path) => TEST_PATH.test(path)) || names.some((name) => TEST_FILE.test(name));

  const docsPresent = files.some((path) => /^docs?\//i.test(path));

  const manifestPresent = names.some((name) => MANIFESTS.has(name.toLowerCase()));

  const licenseSample = samples.find((sample) => LICENSE.test(basename(sample.path)));
  const detectedLicense = licenseName(licenseSample?.text ?? null);

  const checks: HygieneCheck[] = [
    {
      id: 'readme',
      label: 'README',
      ok: has(README),
      weight: 0.18,
      detail: '项目的第一印象，面试官 15 秒内唯一会看的文件',
    },
    {
      id: 'license',
      label: 'LICENSE',
      ok: has(LICENSE),
      weight: 0.14,
      detail: detectedLicense ? `检测到 ${detectedLicense}` : '没有许可证，别人无法合法使用你的代码',
    },
    {
      id: 'gitignore',
      label: '.gitignore',
      ok: has(/^\.gitignore$/i),
      weight: 0.1,
      detail: '避免把 node_modules、构建产物、密钥提交进仓库',
    },
    {
      id: 'ci',
      label: 'CI 配置',
      ok: ciFiles > 0,
      weight: 0.18,
      detail: ciFiles > 0 ? `发现 ${ciFiles} 个 workflow` : '自动化测试/构建能让质量可被验证',
    },
    {
      id: 'tests',
      label: '测试',
      ok: testsPresent,
      weight: 0.18,
      detail: testsPresent ? '存在测试目录或用例文件' : '没有测试的代码，别人不敢改',
    },
    {
      id: 'manifest',
      label: '依赖清单',
      ok: manifestPresent,
      weight: 0.1,
      detail: manifestPresent ? '有构建/依赖元数据，可复现' : '缺少 package.json 等元数据，无法一键运行',
    },
    {
      id: 'docs',
      label: '文档目录',
      ok: docsPresent,
      weight: 0.06,
      detail: docsPresent ? '有 docs/ 目录' : '可选：架构说明、设计取舍写清楚会加分',
    },
    {
      id: 'changelog',
      label: 'CHANGELOG',
      ok: has(CHANGELOG) || has(CONTRIBUTING),
      weight: 0.06,
      detail: has(CHANGELOG) ? '有变更记录' : '可选：CHANGELOG / CONTRIBUTING',
    },
  ];

  return { checks, licenseName: detectedLicense, ciFiles };
}
