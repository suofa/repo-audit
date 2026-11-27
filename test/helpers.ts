import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface TempRepo {
  dir: string;
  write(path: string, content: string): void;
  commit(message: string, date?: Date): void;
  cleanup(): void;
}

/** Creates a throw-away git repository so tests never touch the real one. */
export function makeTempRepo(prefix = 'repo-audit-test-'): TempRepo {
  const dir = mkdtempSync(join(tmpdir(), prefix));

  const git = (args: string[], env: Record<string, string> = {}): void => {
    execFileSync('git', args, {
      cwd: dir,
      stdio: 'pipe',
      env: { ...process.env, ...env, GIT_CONFIG_NOSYSTEM: '1' },
    });
  };

  git(['init', '--initial-branch=main']);
  git(['config', 'user.name', 'Test Author']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'commit.gpgsign', 'false']);

  const write = (path: string, content: string): void => {
    const absolute = join(dir, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, 'utf8');
  };

  const commit = (message: string, date?: Date): void => {
    git(['add', '-A']);
    const env: Record<string, string> = {};
    if (date) {
      env.GIT_AUTHOR_DATE = date.toISOString();
      env.GIT_COMMITTER_DATE = date.toISOString();
    }
    git(['commit', '-m', message, '--no-gpg-sign'], env);
  };

  return {
    dir,
    write,
    commit,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** A repository that passes most hygiene checks, used as the "healthy" baseline. */
export function makeHealthyRepo(): TempRepo {
  const repo = makeTempRepo();
  repo.write('README.md', '# demo\n\nA demo project.\n');
  repo.write('LICENSE', 'MIT License\n\nCopyright (c) 2026\n');
  repo.write('.gitignore', 'node_modules/\n');
  repo.write('package.json', '{"name":"demo","version":"1.0.0"}\n');
  repo.write('.github/workflows/ci.yml', 'name: ci\non: [push]\njobs: {}\n');
  repo.write('test/demo.test.js', 'test("ok", () => {});\n');
  repo.write('src/index.js', 'export const answer = 42;\n');
  repo.write('docs/architecture.md', '# architecture\n');
  repo.write('CHANGELOG.md', '# changelog\n\n## 1.0.0\n');
  repo.commit('feat: initial scaffold');
  return repo;
}
