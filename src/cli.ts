#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { scanRepository, NotARepositoryError } from './core/scan.ts';
import { scoreScan } from './core/score.ts';
import { renderTerminal } from './report/terminal.ts';
import { renderHtml } from './report/html.ts';
import { NAME, VERSION } from './version.ts';

const USAGE = `${NAME} v${VERSION} — audit the engineering health of a git repository

用法
  ${NAME} [path] [options]

参数
  path                 要扫描的仓库路径（默认当前目录）

选项
  --json               以 JSON 输出，便于接入 CI 或其他工具
  --html <file>        额外生成一份自包含的 HTML 报告
  --fail-under <n>     总分低于 n 时以退出码 2 结束（用于 CI 门禁）
  --top <n>            列表显示条数，默认 5
  --weeks <n>          活跃度图显示的周数，默认 12
  --no-color           关闭终端颜色
  -h, --help           显示帮助
  -v, --version        显示版本

示例
  ${NAME} .
  ${NAME} ../my-project --html report.html
  ${NAME} . --json --fail-under 70

退出码
  0  成功
  1  参数错误或目标不是 git 仓库
  2  总分低于 --fail-under 阈值
`;

interface Args {
  path: string;
  json: boolean;
  html: string | null;
  failUnder: number | null;
  top: number;
  weeks: number;
  color: boolean;
  help: boolean;
  version: boolean;
}

class UsageError extends Error {}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    path: '.',
    json: false,
    html: null,
    failUnder: null,
    top: 5,
    weeks: 12,
    color: !process.env.NO_COLOR,
    help: false,
    version: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--no-color':
        args.color = false;
        break;
      case '--html': {
        const value = argv[i + 1];
        if (!value || value.startsWith('-')) throw new UsageError('--html 需要一个文件路径');
        args.html = value;
        i += 1;
        break;
      }
      case '--fail-under': {
        const value = Number(argv[i + 1]);
        if (!Number.isFinite(value)) throw new UsageError('--fail-under 需要一个数字');
        args.failUnder = value;
        i += 1;
        break;
      }
      case '--top': {
        const value = Number(argv[i + 1]);
        if (!Number.isFinite(value) || value <= 0) throw new UsageError('--top 需要一个正数');
        args.top = value;
        i += 1;
        break;
      }
      case '--weeks': {
        const value = Number(argv[i + 1]);
        if (!Number.isFinite(value) || value <= 0) throw new UsageError('--weeks 需要一个正数');
        args.weeks = value;
        i += 1;
        break;
      }
      default: {
        if (token.startsWith('-')) throw new UsageError(`未知选项：${token}`);
        positional.push(token);
      }
    }
  }

  if (positional.length > 1) throw new UsageError(`只能指定一个路径，收到：${positional.join(', ')}`);
  if (positional.length === 1) args.path = positional[0];

  return args;
}

export function main(argv: string[] = process.argv.slice(2)): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${NAME}: ${error.message}\n\n${USAGE}`);
      return 1;
    }
    throw error;
  }

  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (args.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  const target = resolve(args.path);

  try {
    const result = scanRepository(target, { weeks: args.weeks, top: args.top });
    const score = scoreScan(result);

    if (args.json) {
      process.stdout.write(`${JSON.stringify({ ...result, score }, null, 2)}\n`);
    } else {
      process.stdout.write(`${renderTerminal(result, score, { color: args.color, top: args.top })}\n`);
    }

    if (args.html) {
      const file = resolve(args.html);
      writeFileSync(file, renderHtml(result, score), 'utf8');
      if (!args.json) process.stderr.write(`HTML 报告已写入 ${file}\n`);
    }

    if (args.failUnder !== null && score.total < args.failUnder) {
      process.stderr.write(`${NAME}: 总分 ${score.total} 低于阈值 ${args.failUnder}\n`);
      return 2;
    }
    return 0;
  } catch (error) {
    if (error instanceof NotARepositoryError) {
      process.stderr.write(`${NAME}: ${error.message}\n`);
      return 1;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${NAME}: ${message}\n`);
    return 1;
  }
}

const exitCode = main();
process.exitCode = exitCode;
