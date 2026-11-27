/** Public data model produced by a scan. Everything here is plain JSON-serialisable data. */

export interface Commit {
  hash: string;
  author: string;
  email: string;
  date: Date;
  subject: string;
}

export interface WeekBucket {
  /** ISO date (YYYY-MM-DD) of the Monday that starts this week. */
  weekStart: string;
  commits: number;
}

export interface AuthorStat {
  name: string;
  commits: number;
  share: number;
}

export interface ActivityReport {
  totalCommits: number;
  commitsLast30: number;
  commitsLast90: number;
  firstCommit: string | null;
  lastCommit: string | null;
  activeDays: number;
  weekly: WeekBucket[];
  authors: AuthorStat[];
  busFactor: number;
}

export interface ExtensionStat {
  ext: string;
  files: number;
  lines: number;
}

export interface FileStat {
  path: string;
  lines: number;
  bytes: number;
}

export interface SizeReport {
  fileCount: number;
  totalLines: number;
  totalBytes: number;
  binaryFiles: number;
  byExtension: ExtensionStat[];
  largestFiles: FileStat[];
}

export interface HygieneCheck {
  id: string;
  label: string;
  ok: boolean;
  /** Relative weight inside the hygiene dimension, 0..1. */
  weight: number;
  detail: string;
}

export interface HygieneReport {
  checks: HygieneCheck[];
  licenseName: string | null;
  ciFiles: number;
}

export interface MarkerCount {
  kind: string;
  count: number;
}

export interface DebtReport {
  markerCount: number;
  markers: MarkerCount[];
  topFiles: { path: string; count: number }[];
  /** Markers per 1000 lines of code. */
  density: number;
  bigFiles: { path: string; lines: number }[];
}

export interface CommitQualityReport {
  total: number;
  conventional: number;
  conventionalRatio: number;
  lazyMessages: number;
  lazyRatio: number;
  avgSubjectLength: number;
}

export interface ScanTarget {
  /** Directory that was scanned. */
  path: string;
  /** Repository top level reported by git. */
  root: string;
  name: string;
}

export interface ScanResult {
  target: ScanTarget;
  generatedAt: string;
  activity: ActivityReport;
  size: SizeReport;
  hygiene: HygieneReport;
  debt: DebtReport;
  commitQuality: CommitQualityReport;
}

export interface DimensionScore {
  key: string;
  label: string;
  /** 0..100 */
  score: number;
  /** 0..1, sums to 1 across dimensions. */
  weight: number;
  detail: string;
}

export interface ScoreReport {
  total: number;
  grade: string;
  dimensions: DimensionScore[];
}

export interface ScanOptions {
  /** Maximum number of commits to read from the log. */
  maxCommits?: number;
  /** Number of weeks shown in the activity chart. */
  weeks?: number;
  /** How many rows the terminal report prints for top-N lists. */
  top?: number;
  /** Clock override, mainly for tests. */
  now?: Date;
}
