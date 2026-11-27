import type { DimensionScore, ScanResult, ScoreReport } from '../types.ts';

const WEIGHTS = {
  activity: 0.25,
  hygiene: 0.3,
  structure: 0.1,
  debt: 0.15,
  commitQuality: 0.2,
} as const;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Recent work matters more than total volume: a repo that stopped moving is a risk. */
function scoreActivity(result: ScanResult): DimensionScore {
  const { commitsLast90, totalCommits, busFactor } = result.activity;

  const recency = clamp01(commitsLast90 / 20);
  const volume = clamp01(Math.log10(1 + totalCommits) / Math.log10(201));
  const bus = busFactor >= 3 ? 1 : busFactor === 2 ? 0.65 : 0.3;

  const score = 100 * (0.45 * recency + 0.3 * volume + 0.25 * bus);
  return {
    key: 'activity',
    label: '活跃度',
    score,
    weight: WEIGHTS.activity,
    detail: `近 90 天 ${commitsLast90} 次提交，累计 ${totalCommits} 次，bus factor ${busFactor}`,
  };
}

function scoreHygiene(result: ScanResult): DimensionScore {
  const { checks } = result.hygiene;
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const passedWeight = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  const passedCount = checks.filter((check) => check.ok).length;
  const ratio = totalWeight > 0 ? passedWeight / totalWeight : 0;

  return {
    key: 'hygiene',
    label: '工程规范',
    score: 100 * ratio,
    weight: WEIGHTS.hygiene,
    detail: `${passedCount}/${checks.length} 项检查通过`,
  };
}

/** A healthy project has real volume but no monster files. */
function scoreStructure(result: ScanResult): DimensionScore {
  const { totalLines, fileCount, largestFiles } = result.size;
  const biggest = largestFiles.length > 0 ? largestFiles[0].lines : 0;

  const volume = clamp01(Math.log10(1 + totalLines) / Math.log10(1 + 20000));
  const average = fileCount > 0 ? totalLines / fileCount : 0;
  const splitPenalty = average > 600 ? 0.5 : 0;
  const monsterPenalty = clamp01((biggest - 800) / 2000);

  const score = 100 * clamp01(0.65 * volume + 0.35 * (1 - splitPenalty) - monsterPenalty * 0.35);
  return {
    key: 'structure',
    label: '代码结构',
    score,
    weight: WEIGHTS.structure,
    detail: `${totalLines} 行 / ${fileCount} 个文件，最大单文件 ${biggest} 行`,
  };
}

function scoreDebt(result: ScanResult): DimensionScore {
  const { markerCount, density } = result.debt;
  // 1-3 markers per KLOC is normal; 12+ means the codebase is vocal about its pain.
  const score = 100 * clamp01(1 - density / 12);
  return {
    key: 'debt',
    label: '技术债',
    score,
    weight: WEIGHTS.debt,
    detail: `${markerCount} 处 TODO/FIXME，密度 ${density.toFixed(2)} 处/千行`,
  };
}

function scoreCommitQuality(result: ScanResult): DimensionScore {
  const { conventionalRatio, lazyRatio, avgSubjectLength } = result.commitQuality;

  // 20-72 characters is the sweet spot for a git subject line.
  const lengthScore =
    avgSubjectLength >= 20 && avgSubjectLength <= 72
      ? 1
      : avgSubjectLength <= 0
        ? 0
        : clamp01(1 - Math.abs(avgSubjectLength - 46) / 46);

  const score = 100 * clamp01(0.45 * conventionalRatio + 0.35 * (1 - lazyRatio) + 0.2 * lengthScore);
  return {
    key: 'commitQuality',
    label: '提交质量',
    score,
    weight: WEIGHTS.commitQuality,
    detail: `规范提交 ${percent(conventionalRatio)}，低质量信息 ${percent(lazyRatio)}，平均 ${Math.round(avgSubjectLength)} 字符`,
  };
}

export function gradeFor(total: number): string {
  if (total >= 90) return 'A+';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  return 'F';
}

export function scoreScan(result: ScanResult): ScoreReport {
  const dimensions = [
    scoreActivity(result),
    scoreHygiene(result),
    scoreStructure(result),
    scoreDebt(result),
    scoreCommitQuality(result),
  ];

  const total = dimensions.reduce((sum, dimension) => sum + dimension.score * dimension.weight, 0);
  return {
    total: Math.round(total * 10) / 10,
    grade: gradeFor(total),
    dimensions,
  };
}
