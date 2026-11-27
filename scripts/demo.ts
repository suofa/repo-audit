/**
 * Builds a throw-away repository with a realistic history so that the report
 * can be demonstrated (and screenshotted) without shipping fake data in git.
 *
 *   npm run demo
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { scanRepository } from '../src/core/scan.ts';
import { scoreScan } from '../src/core/score.ts';
import { renderTerminal } from '../src/report/terminal.ts';

interface Author {
  name: string;
  email: string;
}

const AUTHORS: Author[] = [
  { name: 'Lin Wei', email: 'linwei@example.com' },
  { name: 'Zhang Yu', email: 'zhangyu@example.com' },
  { name: 'Chen Mo', email: 'chenmo@example.com' },
];

const FILES: { path: string; content: string }[] = [
  {
    path: 'README.md',
    content: `# orbit-api

A small task-tracking HTTP API used as the sample project for repo-audit.

## Getting started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | /tasks | list tasks |
| POST | /tasks | create a task |
| PATCH | /tasks/:id | update status |
`,
  },
  { path: 'LICENSE', content: 'MIT License\n\nCopyright (c) 2026 orbit-api contributors\n' },
  { path: '.gitignore', content: 'node_modules/\ndist/\n*.log\n' },
  {
    path: '.github/workflows/ci.yml',
    content: 'name: ci\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n',
  },
  { path: 'package.json', content: '{\n  "name": "orbit-api",\n  "version": "1.4.2"\n}\n' },
  {
    path: 'src/server.ts',
    content: `import { createRouter } from './router.ts';

const router = createRouter();

export function handle(request: Request): Response {
  return router.dispatch(request);
}
`,
  },
  {
    path: 'src/router.ts',
    content: `type Handler = (params: Record<string, string>) => Response;

export function createRouter() {
  const routes = new Map<string, Handler>();
  return {
    get(path: string, handler: Handler) {
      routes.set(\`GET \${path}\`, handler);
    },
    dispatch(request: Request): Response {
      const url = new URL(request.url);
      const handler = routes.get(\`\${request.method} \${url.pathname}\`);
      if (!handler) return new Response('not found', { status: 404 });
      return handler({});
    },
  };
}
`,
  },
  {
    path: 'src/repository.ts',
    content: `export interface Task {
  id: string;
  title: string;
  done: boolean;
}

export class TaskRepository {
  private readonly tasks = new Map<string, Task>();

  list(): Task[] {
    return [...this.tasks.values()];
  }

  add(title: string): Task {
    const task = { id: crypto.randomUUID(), title, done: false };
    this.tasks.set(task.id, task);
    return task;
  }
}
`,
  },
  {
    path: 'src/validation.ts',
    content: `export function assertTitle(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('title is required');
  }
  if (value.length > 200) throw new Error('title is too long');
  return value.trim();
}
`,
  },
  {
    path: 'test/repository.test.ts',
    content: `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TaskRepository } from '../src/repository.ts';

test('adds tasks', () => {
  const repo = new TaskRepository();
  assert.equal(repo.add('write tests').done, false);
  assert.equal(repo.list().length, 1);
});
`,
  },
  {
    path: 'test/router.test.ts',
    content: `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouter } from '../src/router.ts';

test('unknown routes return 404', () => {
  const router = createRouter();
  const response = router.dispatch(new Request('http://localhost/nope'));
  assert.equal(response.status, 404);
});
`,
  },
  {
    path: 'docs/architecture.md',
    content: `# Architecture

Requests flow through \`server.ts\` into the router, which delegates to the
repository layer. Validation lives at the edge so handlers stay small.
`,
  },
  { path: 'CHANGELOG.md', content: '# Changelog\n\n## 1.4.2\n- fix: guard against empty titles\n\n## 1.4.0\n- feat: task repository\n' },
];

const MESSAGES = [
  'feat(api): add task repository',
  'feat(api): expose list endpoint',
  'fix(validation): reject empty titles',
  'test(repository): cover add and list',
  'docs: describe the request flow',
  'refactor(router): return typed handlers',
  'chore(ci): run tests on every push',
  'feat(api): support task status updates',
  'fix(router): return 404 for unknown paths',
  'test(router): cover the not-found branch',
  'perf(repository): avoid copying on every read',
  'docs(changelog): record 1.4.2 fixes',
];

function git(dir: string, args: string[], env: Record<string, string> = {}): void {
  execFileSync('git', args, {
    cwd: dir,
    stdio: 'pipe',
    env: { ...process.env, ...env, GIT_CONFIG_NOSYSTEM: '1' },
  });
}

/** Builds the sample repository and returns its path. */
export function buildDemoRepo(totalCommits = 42, targetDir?: string): string {
  const dir = targetDir ?? mkdtempSync(join(tmpdir(), 'repo-audit-demo-'));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  git(dir, ['init', '--initial-branch=main']);
  git(dir, ['config', 'commit.gpgsign', 'false']);

  const now = Date.now();
  const spanDays = 150;

  for (let index = 0; index < totalCommits; index += 1) {
    const file = FILES[index % FILES.length];
    const author = AUTHORS[index % 7 === 0 ? 2 : index % 3 === 0 ? 1 : 0];
    const daysAgo = Math.round(spanDays * (1 - index / (totalCommits - 1)));
    const date = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - (index % 9) * 3600 * 1000);

    const absolute = join(dir, file.path);
    mkdirSync(dirname(absolute), { recursive: true });
    const revision = Math.floor(index / FILES.length) + 1;
    writeFileSync(absolute, revision > 1 ? `${file.content}\n// revision ${revision}\n` : file.content, 'utf8');

    git(dir, ['add', '-A']);
    git(dir, ['-c', `user.name=${author.name}`, '-c', `user.email=${author.email}`, 'commit', '-q', '-m', MESSAGES[index % MESSAGES.length]], {
      GIT_AUTHOR_DATE: date.toISOString(),
      GIT_COMMITTER_DATE: date.toISOString(),
    });
  }

  return dir;
}

if (process.argv[1]?.endsWith('demo.ts') || process.argv[1]?.endsWith('demo.js')) {
  const { values } = parseArgs({ options: { keep: { type: 'boolean', default: false } } });
  const dir = buildDemoRepo();
  const result = scanRepository(dir);
  process.stdout.write(`${renderTerminal(result, scoreScan(result), { color: true })}\n`);
  process.stdout.write(`\n样例仓库位于：${dir}\n`);

  if (!values.keep) {
    setTimeout(() => rmSync(dir, { recursive: true, force: true }), 0);
  }
}
