import type { ScanResult, ScoreReport } from '../types.ts';

/**
 * Turns the metrics into a short, ranked list of things worth fixing.
 * The list is intentionally small: a report that says everything is a report
 * that says nothing.
 */
export function buildAdvice(result: ScanResult, score: ScoreReport, options: { max?: number } = {}): string[] {
  const max = options.max ?? 4;
  const advice: { text: string; impact: number }[] = [];

  const failing = result.hygiene.checks.filter((check) => !check.ok);
  const missing = new Map(failing.map((check) => [check.id, check]));

  if (missing.has('readme')) {
    advice.push({ text: '补一个 README：一句话说明它是什么、给谁用、怎么跑起来。', impact: 1 });
  }
  if (missing.has('tests')) {
    advice.push({ text: '加测试：哪怕只覆盖核心逻辑，也能证明代码可被安全修改。', impact: 0.9 });
  }
  if (missing.has('ci')) {
    advice.push({ text: '加 CI（.github/workflows/ci.yml）：让每次 push 自动跑测试。', impact: 0.85 });
  }
  if (missing.has('license')) {
    advice.push({ text: '加 LICENSE（MIT 最简单）：没有许可证别人无法合法使用。', impact: 0.5 });
  }
  if (missing.has('gitignore')) {
    advice.push({ text: '加 .gitignore，避免提交 node_modules 和构建产物。', impact: 0.45 });
  }
  if (missing.has('manifest')) {
    advice.push({ text: '补依赖清单（package.json / pyproject.toml 等），让别人能一键复现。', impact: 0.4 });
  }

  if (result.debt.density > 3) {
    advice.push({
      text: `清理技术债：${result.debt.markerCount} 处 TODO/FIXME 摊在 ${Math.round(result.debt.density)} 处/千行，挑前三个解决。`,
      impact: 0.6,
    });
  }
  if (result.activity.commitsLast90 === 0) {
    advice.push({ text: '仓库近 90 天没有提交：持续的小提交比一次大爆发更有说服力。', impact: 0.7 });
  }
  if (result.activity.busFactor <= 1 && result.activity.totalCommits > 5) {
    advice.push({ text: '只有一个人提交（bus factor 1）：邀请同学共同维护，能体现协作能力。', impact: 0.3 });
  }
  if (result.commitQuality.lazyRatio > 0.3) {
    advice.push({
      text: `提交信息过于随意（${Math.round(result.commitQuality.lazyRatio * 100)}%）：“update”“fix”改成“做了什么 + 为什么”。`,
      impact: 0.55,
    });
  }
  if (result.commitQuality.conventionalRatio < 0.2 && result.activity.totalCommits >= 10) {
    advice.push({ text: '试试 Conventional Commits（feat: / fix: / docs:），历史一眼就能读懂。', impact: 0.35 });
  }
  const biggest = result.size.largestFiles[0];
  if (biggest && biggest.lines > 800) {
    advice.push({ text: `拆分超大文件：${biggest.path} 有 ${biggest.lines} 行，按职责拆成多个模块。`, impact: 0.5 });
  }

  return advice
    .sort((a, b) => b.impact - a.impact)
    .slice(0, max)
    .map((item) => item.text);
}

/** One-line verdict used by both reports. */
export function verdict(score: ScoreReport): string {
  if (score.total >= 85) return '工程化水平优秀，可以直接放进简历。';
  if (score.total >= 70) return '基础扎实，补齐短板后是一个很有说服力的项目。';
  if (score.total >= 55) return '能跑但还缺“让别人敢用”的证据（测试、CI、文档）。';
  return '目前更像课程作业，建议按建议列表逐条补齐。';
}
