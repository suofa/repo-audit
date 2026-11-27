export { scanRepository, NotARepositoryError } from './core/scan.ts';
export { scoreScan, gradeFor } from './core/score.ts';
export { buildAdvice, verdict } from './core/advice.ts';
export { renderTerminal } from './report/terminal.ts';
export { renderHtml, escapeHtml } from './report/html.ts';
export { buildActivity } from './core/metrics/activity.ts';
export { buildSize } from './core/metrics/size.ts';
export { buildHygiene } from './core/metrics/hygiene.ts';
export { buildDebt } from './core/metrics/debt.ts';
export { buildCommitQuality } from './core/metrics/commit-quality.ts';
export { NAME, VERSION } from './version.ts';

export type * from './types.ts';
