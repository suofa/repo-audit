import type { ScanResult, ScoreReport } from '../types.ts';
import { buildAdvice, verdict } from '../core/advice.ts';
import { NAME, VERSION } from '../version.ts';
import { bar, displayWidth, formatBytes, formatDate, formatNumber, padEnd, percent, sparkline, truncate } from '../util/format.ts';

export interface TerminalOptions {
  color?: boolean;
  top?: number;
}

const RULE = '─';

/** Renders the full terminal report as a single string. */
export function renderTerminal(result: ScanResult, score: ScoreReport, options: TerminalOptions = {}): string {
  const color = options.color ?? true;
  const top = options.top ?? 5;
  const paint = (code: string, text: string): string => (color ? `\u001b[${code}m${text}\u001b[0m` : text);

  const bold = (text: string) => paint('1', text);
  const dim = (text: string) => paint('2', text);
  const green = (text: string) => paint('32', text);
  const yellow = (text: string) => paint('33', text);
  const red = (text: string) => paint('31', text);
  const cyan = (text: string) => paint('36', text);

  const lines: string[] = [];
  const rule = (title: string): void => {
    lines.push('');
    lines.push(bold(cyan(`▌ ${title} `)) + dim(RULE.repeat(Math.max(4, 52 - title.length * 2))));
  };

  // ── header ────────────────────────────────────────────────────────────────
  lines.push(bold(NAME) + dim(`  v${VERSION}  ·  git repository health report`));
  lines.push('');
  lines.push(`  ${dim('仓库')}  ${bold(result.target.name)}`);
  lines.push(`  ${dim('路径')}  ${dim(truncate(result.target.path, 62))}`);
  lines.push(`  ${dim('时间')}  ${formatDate(result.generatedAt)}`);

  const scoreColor = score.total >= 80 ? green : score.total >= 60 ? yellow : red;
  const totalBar = bar(score.total, 100, 28);
  lines.push('');
  lines.push(`  ${bold('总分')}  ${scoreColor(bold(String(score.total)))} ${dim('/ 100')}   ${scoreColor(totalBar)}   ${bold(score.grade)}`);
  lines.push(`        ${dim(verdict(score))}`);

  // ── dimensions ────────────────────────────────────────────────────────────
  rule('维度得分');
  const labelWidth = Math.max(...score.dimensions.map((dimension) => displayWidth(dimension.label)));
  for (const dimension of score.dimensions) {
    const color = dimension.score >= 80 ? green : dimension.score >= 60 ? yellow : red;
    const value = dimension.score.toFixed(1).padStart(5);
    lines.push(
      `  ${padEnd(dimension.label, labelWidth)}  ${color(value)}  ${color(bar(dimension.score, 100, 16))}  ${dim(dimension.detail)}`,
    );
  }

  // ── activity ──────────────────────────────────────────────────────────────
  rule('活跃度');
  const activity = result.activity;
  lines.push(
    `  ${dim('近 30 天')} ${bold(String(activity.commitsLast30))}   ${dim('近 90 天')} ${bold(String(activity.commitsLast90))}   ${dim('累计')} ${bold(String(activity.totalCommits))}   ${dim('活跃天数')} ${bold(String(activity.activeDays))}`,
  );
  lines.push(`  ${dim('首次提交')} ${formatDate(activity.firstCommit)}   ${dim('最后提交')} ${formatDate(activity.lastCommit)}   ${dim('bus factor')} ${bold(String(activity.busFactor))}`);

  if (activity.weekly.length > 0) {
    const counts = activity.weekly.map((bucket) => bucket.commits);
    lines.push('');
    lines.push(`  ${dim('最近 12 周')}  ${cyan(sparkline(counts))}  ${dim(`最高 ${Math.max(...counts)} 次/周`)}`);
  }

  if (activity.authors.length > 0) {
    lines.push('');
    for (const author of activity.authors.slice(0, 4)) {
      lines.push(`  ${padEnd(truncate(author.name, 18), 18)} ${String(author.commits).padStart(4)} ${dim(percent(author.share).padStart(5))}  ${cyan(bar(author.share, 1, 18))}`);
    }
    if (activity.authors.length > 4) {
      lines.push(dim(`  … 另有 ${activity.authors.length - 4} 位作者`));
    }
  }

  // ── size ──────────────────────────────────────────────────────────────────
  rule('代码规模');
  lines.push(
    `  ${dim('文件')} ${bold(formatNumber(result.size.fileCount))}   ${dim('行数')} ${bold(formatNumber(result.size.totalLines))}   ${dim('体积')} ${bold(formatBytes(result.size.totalBytes))}   ${dim('二进制')} ${bold(String(result.size.binaryFiles))}`,
  );

  if (result.size.byExtension.length > 0) {
    lines.push('');
    for (const entry of result.size.byExtension.slice(0, top)) {
      lines.push(`  ${padEnd(`.${entry.ext}`, 10)} ${String(entry.files).padStart(5)} 文件 ${formatNumber(entry.lines).padStart(9)} 行`);
    }
  }

  if (result.size.largestFiles.length > 0) {
    lines.push('');
    lines.push(`  ${dim('最大的文件')}`);
    for (const file of result.size.largestFiles.slice(0, top)) {
      lines.push(`  ${padEnd(truncate(file.path, 44), 44)} ${formatNumber(file.lines).padStart(8)} 行`);
    }
  }

  // ── hygiene ───────────────────────────────────────────────────────────────
  rule('工程规范');
  for (const check of result.hygiene.checks) {
    const mark = check.ok ? green('✓') : red('✗');
    const label = padEnd(check.label, 12);
    lines.push(`  ${mark} ${label} ${check.ok ? '' : dim(check.detail)}`);
  }

  // ── debt ──────────────────────────────────────────────────────────────────
  rule('技术债');
  if (result.debt.markerCount === 0) {
    lines.push(`  ${green('✓')} 没有发现 TODO/FIXME 标记`);
  } else {
    const kinds = result.debt.markers.map((marker) => `${marker.kind} ${marker.count}`).join('   ');
    lines.push(`  ${dim('标记总数')} ${bold(String(result.debt.markerCount))}   ${kinds}`);
    lines.push(`  ${dim('密度')} ${bold(result.debt.density.toFixed(2))} ${dim('处/千行')}`);
    lines.push('');
    for (const file of result.debt.topFiles) {
      lines.push(`  ${padEnd(truncate(file.path, 44), 44)} ${String(file.count).padStart(3)} 处`);
    }
    if (result.debt.bigFiles.length > 0) {
      lines.push('');
      lines.push(`  ${dim('超大文件（> 400 行）')} ${result.debt.bigFiles.map((file) => `${file.path} (${file.lines})`).join('，')}`);
    }
  }

  // ── commit quality ────────────────────────────────────────────────────────
  rule('提交质量');
  const quality = result.commitQuality;
  lines.push(
    `  ${dim('规范提交')} ${bold(percent(quality.conventionalRatio))}   ${dim('低质量信息')} ${bold(percent(quality.lazyRatio))}   ${dim('平均长度')} ${bold(`${Math.round(quality.avgSubjectLength)} 字符`)}`,
  );

  // ── advice ────────────────────────────────────────────────────────────────
  const advice = buildAdvice(result, score);
  if (advice.length > 0) {
    rule('改进建议');
    advice.forEach((item, index) => {
      lines.push(`  ${yellow(String(index + 1))}. ${item}`);
    });
  }

  lines.push('');
  lines.push(dim(`  由 ${NAME} v${VERSION} 生成  ·  ${result.target.root}`));
  lines.push('');

  return lines.join('\n');
}
