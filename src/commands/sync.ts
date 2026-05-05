import { spawnSync } from 'node:child_process';
import { getRepoHealth, loadRepoManifest, type RepoHealth } from '../lib/repos.js';

export type SyncOptions = {
  report?: boolean;
  includePlanned?: boolean;
};

export type SyncRepoResult = {
  repo: string;
  path: string;
  state: 'missing' | 'dirty-skipped' | 'reported' | 'synced' | 'failed' | 'planned-skipped';
  branch: string | null;
  headSha: string | null;
  detail: string;
};

export type SyncResult = {
  reportOnly: boolean;
  repos: SyncRepoResult[];
  ok: boolean;
};

function run(repo: RepoHealth, args: string[]) {
  const result = spawnSync('git', args, { cwd: repo.resolvedPath, encoding: 'utf8' });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

export function runSync(workspaceRoot: string, options: SyncOptions = {}): SyncResult {
  const manifest = loadRepoManifest(workspaceRoot);
  const repos: SyncRepoResult[] = [];

  for (const repoEntry of manifest.repos) {
    const repo = getRepoHealth(workspaceRoot, repoEntry);
    if (repo.status === 'planned' && !options.includePlanned) {
      repos.push({
        repo: repo.github,
        path: repo.configuredPath,
        state: 'planned-skipped',
        branch: null,
        headSha: null,
        detail: 'planned repo skipped',
      });
      continue;
    }

    if (!repo.checkedOut) {
      repos.push({
        repo: repo.github,
        path: repo.resolvedPath,
        state: 'missing',
        branch: null,
        headSha: null,
        detail: 'checkout missing',
      });
      continue;
    }

    if (repo.clean === false) {
      repos.push({
        repo: repo.github,
        path: repo.resolvedPath,
        state: 'dirty-skipped',
        branch: repo.branch,
        headSha: repo.headSha,
        detail: repo.statusLines.join('\n'),
      });
      continue;
    }

    if (options.report) {
      repos.push({
        repo: repo.github,
        path: repo.resolvedPath,
        state: 'reported',
        branch: repo.branch,
        headSha: repo.headSha,
        detail: repo.upstream ? `upstream ${repo.upstream}` : 'no upstream configured',
      });
      continue;
    }

    const fetch = run(repo, ['fetch', '--prune']);
    if (fetch.status !== 0) {
      repos.push({
        repo: repo.github,
        path: repo.resolvedPath,
        state: 'failed',
        branch: repo.branch,
        headSha: repo.headSha,
        detail: fetch.output,
      });
      continue;
    }

    const pull = run(repo, ['pull', '--ff-only']);
    repos.push({
      repo: repo.github,
      path: repo.resolvedPath,
      state: pull.status === 0 ? 'synced' : 'failed',
      branch: repo.branch,
      headSha: repo.headSha,
      detail: pull.output || 'already up to date',
    });
  }

  return {
    reportOnly: options.report ?? false,
    repos,
    ok: repos.every((repo) => repo.state !== 'failed'),
  };
}
