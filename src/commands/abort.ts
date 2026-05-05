import { spawnSync } from 'node:child_process';
import { getRepoHealth, loadRepoManifest } from '../lib/repos.js';

export type AbortOptions = {
  stash?: boolean;
  confirm?: boolean;
  dangerReset?: boolean;
  confirmDanger?: string;
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
  reset: boolean;
};

export type AbortResult = {
  repos: AbortRepoRecovery[];
  mutated: boolean;
  messages: string[];
};

export function runAbort(workspaceRoot: string, options: AbortOptions = {}): AbortResult {
  const manifest = loadRepoManifest(workspaceRoot);
  const repos: AbortRepoRecovery[] = [];
  const messages = ['Preservation-first abort report. Reset/clean actions require --danger-reset and the exact --confirm-danger phrase.'];
  let mutated = false;
  const dangerConfirmed = options.confirmDanger === 'discard local work';

  for (const repoEntry of manifest.repos) {
    const repo = getRepoHealth(workspaceRoot, repoEntry);
    let stashed = false;
    let reset = false;

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

    if (repo.checkedOut && repo.clean === false && options.dangerReset) {
      if (!dangerConfirmed) {
        messages.push(`Skipped destructive reset for ${repo.id}; pass --danger-reset --confirm-danger "discard local work" to discard dirty work.`);
      } else {
        const resetResult = spawnSync('git', ['reset', '--hard'], {
          cwd: repo.resolvedPath,
          stdio: 'inherit',
        });
        if (resetResult.status !== 0) throw new Error(`git reset failed for ${repo.id} with exit ${resetResult.status ?? 'unknown'}.`);
        const cleanResult = spawnSync('git', ['clean', '-fd'], {
          cwd: repo.resolvedPath,
          stdio: 'inherit',
        });
        if (cleanResult.status !== 0) throw new Error(`git clean failed for ${repo.id} with exit ${cleanResult.status ?? 'unknown'}.`);
        reset = true;
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
            `# destructive last resort: git reset --hard && git clean -fd`,
          ]
        : [`git clone ${repo.ssh_url} ${repo.configuredPath}`],
      stashed,
      reset,
    });
  }

  return { repos, mutated, messages };
}
