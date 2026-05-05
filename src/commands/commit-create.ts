import { spawnSync } from 'node:child_process';
import { getRepoById, getRepoHealth, loadRepoManifest } from '../lib/repos.js';

export type CommitCreateOptions = {
  repo?: string;
  message?: string;
  confirm?: boolean;
  all?: boolean;
};

export type CommitCreateResult = {
  repo: string;
  path: string;
  clean: boolean | null;
  statusLines: string[];
  suggestedMessage: string;
  committed: boolean;
  blocked: string[];
};

function suggestMessage(repoId: string, statusLines: string[]) {
  const docsOnly = statusLines.length > 0 && statusLines.every((line) => /\s(docs|README|.*\.md)/i.test(line));
  const prefix = docsOnly ? 'docs' : 'chore';
  return `${prefix}(${repoId}): update war room workflow`;
}

export function runCommitCreate(workspaceRoot: string, options: CommitCreateOptions = {}): CommitCreateResult {
  if (!options.repo) throw new Error('warroom commit create requires --repo <id>.');
  const manifest = loadRepoManifest(workspaceRoot);
  const repoEntry = getRepoById(workspaceRoot, options.repo);
  const repo = getRepoHealth(workspaceRoot, repoEntry);
  const dirtyRepos = manifest.repos
    .map((entry) => getRepoHealth(workspaceRoot, entry))
    .filter((entry) => entry.id !== repo.id && entry.clean === false);
  const blocked: string[] = [];

  if (!repo.checkedOut) blocked.push(`Repo checkout is missing: ${repo.resolvedPath}`);
  if (repo.clean !== false) blocked.push('Repo has no changes to commit.');
  if (dirtyRepos.length > 0) {
    blocked.push(`Other child repos are dirty: ${dirtyRepos.map((entry) => entry.id).join(', ')}`);
  }

  const suggestedMessage = options.message ?? suggestMessage(repo.id, repo.statusLines);
  let committed = false;

  if (options.confirm) {
    if (blocked.length > 0) throw new Error(blocked.join(' '));
    if (options.all) {
      const add = spawnSync('git', ['add', '-A'], { cwd: repo.resolvedPath, stdio: 'inherit' });
      if (add.status !== 0) throw new Error(`git add failed with exit ${add.status ?? 'unknown'}.`);
    }
    const commit = spawnSync('git', ['commit', '-m', suggestedMessage], { cwd: repo.resolvedPath, stdio: 'inherit' });
    if (commit.status !== 0) throw new Error(`git commit failed with exit ${commit.status ?? 'unknown'}.`);
    committed = true;
  }

  return {
    repo: repo.id,
    path: repo.resolvedPath,
    clean: repo.clean,
    statusLines: repo.statusLines,
    suggestedMessage,
    committed,
    blocked,
  };
}
