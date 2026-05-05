import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { checkTool, type ToolCheck } from '../lib/tools.js';
import { getRepoHealth, loadRepoManifest, type RepoHealth } from '../lib/repos.js';

export type BootstrapOptions = {
  dryRun?: boolean;
  includePlanned?: boolean;
};

export type BootstrapRepoAction = {
  repo: string;
  path: string;
  state: 'present' | 'sibling-present' | 'would-clone' | 'cloned' | 'failed' | 'planned-skipped';
  detail: string;
};

export type BootstrapResult = {
  dryRun: boolean;
  tools: ToolCheck[];
  repos: BootstrapRepoAction[];
  ok: boolean;
};

function cloneRepo(repo: RepoHealth) {
  mkdirSync(dirname(repo.configuredPath), { recursive: true });
  return spawnSync('git', ['clone', repo.ssh_url, repo.configuredPath], { encoding: 'utf8' });
}

export function runBootstrap(workspaceRoot: string, options: BootstrapOptions = {}): BootstrapResult {
  const manifest = loadRepoManifest(workspaceRoot);
  const tools = [
    checkTool('git', 'git', ['--version']),
    checkTool('gh', 'gh', ['--version']),
    checkTool('node', 'node', ['--version']),
    checkTool('npm', 'npm', ['--version']),
  ];

  const repos: BootstrapRepoAction[] = [];

  for (const repoEntry of manifest.repos) {
    const repo = getRepoHealth(workspaceRoot, repoEntry);
    if (repo.status === 'planned' && !options.includePlanned) {
      repos.push({
        repo: repo.github,
        path: repo.configuredPath,
        state: 'planned-skipped',
        detail: 'planned repo skipped; pass --include-planned to include it',
      });
      continue;
    }

    if (repo.manifestCheckedOut) {
      repos.push({ repo: repo.github, path: repo.configuredPath, state: 'present', detail: 'checkout already exists' });
      continue;
    }

    if (repo.source === 'sibling') {
      repos.push({
        repo: repo.github,
        path: repo.resolvedPath,
        state: 'sibling-present',
        detail: `sibling checkout detected; bootstrap target remains ${repo.configuredPath}`,
      });
      continue;
    }

    if (options.dryRun) {
      repos.push({ repo: repo.github, path: repo.configuredPath, state: 'would-clone', detail: repo.ssh_url });
      continue;
    }

    const result = cloneRepo(repo);
    repos.push({
      repo: repo.github,
      path: repo.configuredPath,
      state: result.status === 0 ? 'cloned' : 'failed',
      detail: result.status === 0 ? 'clone complete' : `${result.stderr || result.stdout}`.trim(),
    });
  }

  return {
    dryRun: options.dryRun ?? false,
    tools,
    repos,
    ok: tools.every((tool) => tool.ok) && repos.every((repo) => repo.state !== 'failed'),
  };
}
