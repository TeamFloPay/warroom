import { spawnSync } from 'node:child_process';
import { getRepoHealth, loadRepoManifest } from '../lib/repos.js';

export type AbortOptions = {
  stash?: boolean;
  confirm?: boolean;
};

export type AbortRepoRecovery = {
  repo: string;
  path: string;
  checkedOut: boolean;
  branch: string | null;
  headSha: string | null;
  dirty: boolean;
  statusLines: string[];
  recoveryCommands: string[];
  stashed: boolean;
};

export type AbortResult = {
  repos: AbortRepoRecovery[];
  mutated: boolean;
  messages: string[];
};

export function runAbort(workspaceRoot: string, options: AbortOptions = {}): AbortResult {
  const manifest = loadRepoManifest(workspaceRoot);
  const repos: AbortRepoRecovery[] = [];
  const messages = ['Preservation-first abort report. No reset, clean, checkout, or branch deletion is performed.'];
  let mutated = false;

  for (const repoEntry of manifest.repos) {
    const repo = getRepoHealth(workspaceRoot, repoEntry);
    let stashed = false;

    if (repo.checkedOut && repo.clean === false && options.stash) {
      if (!options.confirm) {
        messages.push(`Skipped stash for ${repo.id}; pass --stash --confirm to stash dirty work.`);
      } else {
        const result = spawnSync('git', ['stash', 'push', '-u', '-m', `warroom abort ${new Date().toISOString()}`], {
          cwd: repo.resolvedPath,
          stdio: 'inherit',
        });
        if (result.status !== 0) throw new Error(`git stash failed for ${repo.id} with exit ${result.status ?? 'unknown'}.`);
        stashed = true;
        mutated = true;
      }
    }

    repos.push({
      repo: repo.github,
      path: repo.resolvedPath,
      checkedOut: repo.checkedOut,
      branch: repo.branch,
      headSha: repo.headSha,
      dirty: repo.clean === false,
      statusLines: repo.statusLines,
      recoveryCommands: repo.checkedOut
        ? [
            `cd ${repo.resolvedPath}`,
            'git status --short',
            'git branch --show-current',
            'git stash list',
          ]
        : [`git clone ${repo.ssh_url} ${repo.configuredPath}`],
      stashed,
    });
  }

  return { repos, mutated, messages };
}
