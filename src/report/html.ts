import type { ScanResult, ScoreReport } from '../types.ts';
import { buildAdvice, verdict } from '../core/advice.ts';
import { formatBytes, formatDate, formatNumber, percent } from '../util/format.ts';
import { NAME, VERSION } from '../version.ts';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Every dynamic value goes through here: file paths and author names are untrusted input. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

interface Bar {
  label: string;
  value: number;
  detail?: string;
}

function svgBars(bars: Bar[], options: { height?: number; barWidth?: number; gap?: number } = {}): string {
  const height = options.height ?? 140;
  const barWidth = options.barWidth ?? Math.max(6, Math.floor(760 / Math.max(bars.length, 1)));
  const gap = options.gap ?? 6;
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const width = bars.length * (barWidth + gap);

  const parts: string[] = [];
  bars.forEach((bar, index) => {
    const barHeight = Math.round((bar.value / max) * (height - 28));
    const x = index * (barWidth + gap);
    const y = height - 20 - barHeight;
    parts.push(
      `<rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 1)}" rx="3" fill="url(#grad)"><title>${escapeHtml(`${bar.label}: ${bar.detail ?? bar.value}`)}</title></rect>`,
    );
    if (index % 2 === 0) {
      parts.push(`<text x="${x + barWidth / 2}" y="${height - 6}" font-size="10" fill="#7d8590" text-anchor="middle">${escapeHtml(bar.label)}</text>`);
    }
  });

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="weekly commits">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7ee787"/>
      <stop offset="100%" stop-color="#2ea043"/>
    </linearGradient>
  </defs>
  ${parts.join('\n  ')}
</svg>`;
}

function scoreClass(score: number): string {
  if (score >= 80) return 'good';
  if (score >= 60) return 'warn';
  return 'bad';
}

export function renderHtml(result: ScanResult, score: ScoreReport): string {
  const advice = buildAdvice(result, score);
  const activity = result.activity;

  const weeklyBars = activity.weekly.map((bucket) => ({
    label: bucket.weekStart.slice(5),
    value: bucket.commits,
    detail: `${bucket.weekStart} 当周 ${bucket.commits} 次提交`,
  }));

  const authorRows = activity.authors
    .slice(0, 8)
    .map(
      (author) => `<div class="row">
        <span class="row-name" title="${escapeHtml(author.name)}">${escapeHtml(author.name)}</span>
        <span class="row-bar"><i style="width:${Math.max(2, round(author.share * 100))}%"></i></span>
        <span class="row-value">${author.commits} · ${percent(author.share)}</span>
      </div>`,
    )
    .join('\n');

  const extRows = result.size.byExtension
    .slice(0, 8)
    .map((entry) => `<tr><td><code>.${escapeHtml(entry.ext)}</code></td><td>${formatNumber(entry.files)}</td><td>${formatNumber(entry.lines)}</td></tr>`)
    .join('\n');

  const fileRows = result.size.largestFiles
    .slice(0, 8)
    .map((file) => `<tr><td><code>${escapeHtml(file.path)}</code></td><td>${formatNumber(file.lines)}</td><td>${formatBytes(file.bytes)}</td></tr>`)
    .join('\n');

  const debtRows = result.debt.topFiles
    .map((file) => `<tr><td><code>${escapeHtml(file.path)}</code></td><td>${file.count}</td></tr>`)
    .join('\n');

  const checkItems = result.hygiene.checks
    .map(
      (check) => `<li class="${check.ok ? 'ok' : 'missing'}">
        <span class="mark">${check.ok ? '✓' : '✗'}</span>
        <span class="label">${escapeHtml(check.label)}</span>
        <span class="detail">${escapeHtml(check.detail)}</span>
      </li>`,
    )
    .join('\n');

  const dimensionCards = score.dimensions
    .map(
      (dimension) => `<div class="metric">
        <div class="metric-head">
          <span>${escapeHtml(dimension.label)}</span>
          <b class="${scoreClass(dimension.score)}">${dimension.score.toFixed(1)}</b>
        </div>
        <div class="track"><i class="${scoreClass(dimension.score)}" style="width:${round(dimension.score)}%"></i></div>
        <p>${escapeHtml(dimension.detail)}</p>
      </div>`,
    )
    .join('\n');

  const adviceItems = advice.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(result.target.name)} · ${NAME} 报告</title>
<style>
  :root {
    --bg: #0d1117; --panel: #161b22; --border: #30363d; --text: #e6edf3; --muted: #7d8590;
    --green: #3fb950; --yellow: #d29922; --red: #f85149; --accent: #58a6ff;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 20px 64px; background: var(--bg); color: var(--text);
         font: 14px/1.6 -apple-system, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; }
  .wrap { max-width: 900px; margin: 0 auto; }
  header { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
  h1 { font-size: 22px; margin: 0; }
  .path { color: var(--muted); font-size: 12px; word-break: break-all; }
  .score-ring { margin-left: auto; text-align: center; }
  .score-ring b { display: block; font-size: 40px; line-height: 1; }
  .score-ring span { color: var(--muted); font-size: 12px; }
  .grade { font-weight: 700; letter-spacing: .08em; }
  .verdict { color: var(--muted); margin: 12px 0 24px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted);
       margin: 32px 0 12px; font-weight: 600; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .metric { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
  .metric-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .metric p { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
  .track { height: 6px; background: #21262d; border-radius: 3px; overflow: hidden; }
  .track i { display: block; height: 100%; border-radius: 3px; }
  .good { color: var(--green); } .warn { color: var(--yellow); } .bad { color: var(--red); }
  .track i.good { background: var(--green); } .track i.warn { background: var(--yellow); } .track i.bad { background: var(--red); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
  .stat { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #21262d; }
  .stat:last-child { border-bottom: 0; }
  .stat span { color: var(--muted); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #21262d; }
  th { color: var(--muted); font-weight: 500; }
  td:first-child { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; word-break: break-all; }
  code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; color: var(--accent); }
  ul.checks { list-style: none; margin: 0; padding: 0; }
  ul.checks li { display: grid; grid-template-columns: 20px 120px 1fr; gap: 8px; padding: 5px 0;
                 border-bottom: 1px solid #21262d; align-items: baseline; }
  ul.checks li:last-child { border-bottom: 0; }
  ul.checks .detail { color: var(--muted); font-size: 12px; }
  ul.checks .ok .mark { color: var(--green); } ul.checks .missing .mark { color: var(--red); }
  .row { display: grid; grid-template-columns: 140px 1fr 90px; gap: 10px; align-items: center; padding: 3px 0; }
  .row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-bar { height: 6px; background: #21262d; border-radius: 3px; overflow: hidden; }
  .row-bar i { display: block; height: 100%; background: var(--accent); }
  .row-value { color: var(--muted); font-size: 12px; text-align: right; }
  ol.advice { margin: 0; padding-left: 22px; }
  ol.advice li { margin: 6px 0; }
  footer { margin-top: 40px; color: var(--muted); font-size: 12px; }
  @media print { body { background: #fff; color: #111; } .card, .metric { border-color: #ddd; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>${escapeHtml(result.target.name)}</h1>
      <div class="path">${escapeHtml(result.target.root)}</div>
    </div>
    <div class="score-ring">
      <b class="${scoreClass(score.total)}">${score.total}</b>
      <span>/ 100 · <span class="grade">${escapeHtml(score.grade)}</span></span>
    </div>
  </header>
  <p class="verdict">${escapeHtml(verdict(score))}</p>

  <h2>维度得分</h2>
  <div class="metrics">
${dimensionCards}
  </div>

  <h2>活跃度</h2>
  <div class="card">
    <div class="stat"><span>累计提交</span><b>${activity.totalCommits}</b></div>
    <div class="stat"><span>近 30 天</span><b>${activity.commitsLast30}</b></div>
    <div class="stat"><span>近 90 天</span><b>${activity.commitsLast90}</b></div>
    <div class="stat"><span>活跃天数</span><b>${activity.activeDays}</b></div>
    <div class="stat"><span>首次 / 最后提交</span><b>${formatDate(activity.firstCommit)} → ${formatDate(activity.lastCommit)}</b></div>
    <div class="stat"><span>Bus factor</span><b>${activity.busFactor}</b></div>
    ${weeklyBars.length > 0 ? `<div style="margin-top:14px">${svgBars(weeklyBars)}</div>` : ''}
    ${authorRows ? `<div style="margin-top:14px">${authorRows}</div>` : ''}
  </div>

  <h2>代码规模</h2>
  <div class="cards">
    <div class="card">
      <div class="stat"><span>文件</span><b>${formatNumber(result.size.fileCount)}</b></div>
      <div class="stat"><span>总行数</span><b>${formatNumber(result.size.totalLines)}</b></div>
      <div class="stat"><span>总体积</span><b>${formatBytes(result.size.totalBytes)}</b></div>
      <div class="stat"><span>二进制文件</span><b>${result.size.binaryFiles}</b></div>
    </div>
    <div class="card">
      <table><thead><tr><th>扩展名</th><th>文件</th><th>行数</th></tr></thead><tbody>
${extRows}
      </tbody></table>
    </div>
  </div>

  <h2>最大的文件</h2>
  <div class="card"><table><thead><tr><th>路径</th><th>行数</th><th>大小</th></tr></thead><tbody>
${fileRows}
  </tbody></table></div>

  <h2>工程规范</h2>
  <div class="card"><ul class="checks">
${checkItems}
  </ul></div>

  <h2>技术债</h2>
  <div class="card">
    <div class="stat"><span>TODO / FIXME 总数</span><b>${result.debt.markerCount}</b></div>
    <div class="stat"><span>密度（处 / 千行）</span><b>${result.debt.density.toFixed(2)}</b></div>
    ${debtRows ? `<table style="margin-top:12px"><thead><tr><th>文件</th><th>数量</th></tr></thead><tbody>\n${debtRows}\n</tbody></table>` : ''}
  </div>

  <h2>提交质量</h2>
  <div class="card">
    <div class="stat"><span>Conventional Commits 占比</span><b>${percent(result.commitQuality.conventionalRatio)}</b></div>
    <div class="stat"><span>低质量提交信息</span><b>${percent(result.commitQuality.lazyRatio)}</b></div>
    <div class="stat"><span>平均标题长度</span><b>${Math.round(result.commitQuality.avgSubjectLength)} 字符</b></div>
  </div>

  ${adviceItems ? `<h2>改进建议</h2>\n  <div class="card"><ol class="advice">\n${adviceItems}\n  </ol></div>` : ''}

  <footer>${NAME} v${VERSION} · 生成于 ${escapeHtml(result.generatedAt)}</footer>
</div>
</body>
</html>
`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
