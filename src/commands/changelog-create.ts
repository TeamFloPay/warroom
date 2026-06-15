import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { getAdapterInvocation, runAdapter } from '../lib/env.js';
import { createUsageCommandRunId } from '../lib/llm-usage.js';
import { getRepoById, getRepoHealth, loadRepoManifest, runGit } from '../lib/repos.js';
import { inferRepoFromPath } from './commit-create.js';
import {
  buildChangelogPrompt,
  markdownFrontmatterTitle,
  readOpenChangelogNotes,
  readPackageVersions,
} from './pr.js';

export type ChangelogCreateOptions = {
  repo?: string;
  base?: string;
  issue?: string;
  currentPath?: string;
  confirm?: boolean;
};

export type ChangelogChangedFile = {
  path: string;
  additions: number;
  deletions: number;
};

export type ChangelogCreateResult = {
  status: 'created' | 'planned' | 'blocked' | 'failed';
  repo: string;
  repoId: string;
  path: string | null;
  base: string;
  branch: string | null;
  changelogFormat: 'keep-a-changelog' | 'openchangelog';
  changelogEnabled: boolean;
  changelogDir: string;
  changelogPath: string | null;
  changelogUrl: string | null;
  changelogFile: string | null;
  title: string | null;
  version: string | null;
  changedFiles: ChangelogChangedFile[];
  adapterCommand: string | null;
  durationMs: number | null;
  blocked: string[];
  error: string | null;
};

function gitRefExists(repoPath: string, ref: string): boolean {
  return runGit(repoPath, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status === 0;
}

// The "current edited files/diff from main": tracked changes between the base
// commit and the working tree (committed-on-branch plus staged/unstaged edits)
// merged with brand-new untracked files git diff would otherwise miss.
function collectChangedFiles(repoPath: string, base: string): ChangelogChangedFile[] {
  const files = new Map<string, ChangelogChangedFile>();

  const numstat = runGit(repoPath, ['diff', '--numstat', base, '--']);
  if (numstat.status === 0) {
    for (const line of numstat.stdout.split(/\r?\n/).filter(Boolean)) {
      const [adds, dels, ...rest] = line.split('\t');
      const filePath = rest.join('\t');
      if (!filePath) continue;
      files.set(filePath, {
        path: filePath,
        additions: adds === '-' ? 0 : Number(adds) || 0,
        deletions: dels === '-' ? 0 : Number(dels) || 0,
      });
    }
  }

  const untracked = runGit(repoPath, ['ls-files', '--others', '--exclude-standard']);
  if (untracked.status === 0) {
    for (const filePath of untracked.stdout.split(/\r?\n/).filter(Boolean)) {
      if (files.has(filePath)) continue;
      let additions = 0;
      try {
        additions = readFileSync(path.join(repoPath, filePath), 'utf8').split(/\r?\n/).length;
      } catch {
        additions = 0;
      }
      files.set(filePath, { path: filePath, additions, deletions: 0 });
    }
  }

  return [...files.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function synthesizePr(
  repoPath: string,
  branch: string | null,
  base: string,
  changedFiles: ChangelogChangedFile[]
) {
  const hasBase = gitRefExists(repoPath, base);
  const subjects = hasBase
    ? runGit(repoPath, ['log', `${base}..HEAD`, '--pretty=format:%s']).stdout.split(/\r?\n/).filter(Boolean)
    : [];
  const title = subjects[0] ?? (branch ? `Changes on ${branch}` : 'Working tree changes');
  const bodyLog = hasBase ? runGit(repoPath, ['log', `${base}..HEAD`, '--pretty=format:- %s%n%b']).stdout.trim() : '';
  const body = bodyLog || `Uncommitted working tree changes against ${base} (no commits ahead of the base branch).`;
  return {
    title,
    url: undefined,
    body,
    files: changedFiles.map((file) => ({ path: file.path, additions: file.additions, deletions: file.deletions })),
  };
}

function listReleaseNotes(dir: string | null): Set<string> {
  if (!dir || !existsSync(dir)) return new Set();
  try {
    return new Set(readdirSync(dir).filter((entry) => entry.endsWith('.md')));
  } catch {
    return new Set();
  }
}

// Generate a fresh changelog entry from the working-tree diff against the base
// branch, reusing the same prompt, format handling, and LLM adapter as the
// post-merge changelog step in `warroom pr merge`. Unlike that flow this never
// commits, pushes, or reverts the operator's other working-tree edits — it just
// writes the new changelog file in place and reports it.
export function runChangelogCreate(workspaceRoot: string, options: ChangelogCreateOptions = {}): ChangelogCreateResult {
  const commandRunId = createUsageCommandRunId('changelog-create');
  const manifest = loadRepoManifest(workspaceRoot);
  const repoHealth = manifest.repos.map((entry) => getRepoHealth(workspaceRoot, entry));
  const repoId = options.repo ?? inferRepoFromPath(repoHealth, options.currentPath ?? process.cwd());
  if (!repoId) {
    throw new Error(
      'warroom changelog create requires --repo <id> unless run inside a mapped child repo checkout.'
    );
  }

  const repoEntry = getRepoById(workspaceRoot, repoId);
  const repo = getRepoHealth(workspaceRoot, repoEntry);
  const base = options.base ?? manifest.defaults.default_branch;
  const changelogConfig = repoEntry.merge.changelog;
  const changelogPath = repo.checkedOut ? path.join(repo.resolvedPath, changelogConfig.path) : null;

  const blocked: string[] = [];
  let changedFiles: ChangelogChangedFile[] = [];

  if (!repo.checkedOut) {
    blocked.push(`Repo checkout is missing: ${repo.resolvedPath}`);
  } else if (!gitRefExists(repo.resolvedPath, base)) {
    blocked.push(`Base ref "${base}" was not found in ${repo.resolvedPath}. Fetch it or pass --base <branch>.`);
  } else {
    changedFiles = collectChangedFiles(repo.resolvedPath, base);
    if (changedFiles.length === 0) {
      blocked.push(`No changes detected against ${base}. Edit files first or pass a different --base.`);
    }
  }

  if (
    changelogPath &&
    changelogConfig.format === 'openchangelog' &&
    existsSync(changelogPath) &&
    !statSync(changelogPath).isDirectory()
  ) {
    blocked.push(`OpenChangelog release notes path must be a directory: ${changelogPath}`);
  }

  const version = repo.checkedOut ? readPackageVersions(repo.resolvedPath)[0]?.version ?? null : null;
  const adapterCommand = repo.checkedOut ? getAdapterInvocation(workspaceRoot, repo.resolvedPath).display : null;

  const baseResult: ChangelogCreateResult = {
    status: 'planned',
    repo: repo.github,
    repoId: repo.id,
    path: repo.checkedOut ? repo.resolvedPath : null,
    base,
    branch: repo.branch,
    changelogFormat: changelogConfig.format,
    changelogEnabled: changelogConfig.enabled,
    changelogDir: changelogConfig.path,
    changelogPath,
    changelogUrl: changelogConfig.url,
    changelogFile: null,
    title: null,
    version,
    changedFiles,
    adapterCommand,
    durationMs: null,
    blocked,
    error: null,
  };

  if (blocked.length > 0) return { ...baseResult, status: 'blocked' };
  if (!options.confirm) return baseResult;

  const startedAt = Date.now();
  try {
    const beforeReleaseNotes = changelogConfig.format === 'openchangelog' ? listReleaseNotes(changelogPath) : new Set<string>();
    const beforeChangelog =
      changelogConfig.format === 'keep-a-changelog' && changelogPath && existsSync(changelogPath)
        ? readFileSync(changelogPath, 'utf8')
        : '';

    const pr = synthesizePr(repo.resolvedPath, repo.branch, base, changedFiles);
    const prompt = buildChangelogPrompt({
      prRef: `${repo.github}@${repo.branch ?? base}`,
      issueRef: options.issue,
      pr,
      versions: readPackageVersions(repo.resolvedPath),
      changelogFormat: changelogConfig.format,
      changelogPath: changelogConfig.path,
      changelog: beforeChangelog,
      existingOpenChangelogNotes:
        changelogConfig.format === 'openchangelog' && changelogPath ? readOpenChangelogNotes(changelogPath) : undefined,
      nowIso: new Date().toISOString(),
    });

    const adapter = runAdapter(workspaceRoot, prompt, {
      cwd: repo.resolvedPath,
      usage: {
        issue: options.issue ?? null,
        command: 'changelog-create',
        stage: 'changelog',
        repo: repo.github,
        commandRunId,
      },
    });
    if (!adapter.launched) {
      return {
        ...baseResult,
        status: 'failed',
        adapterCommand: adapter.invocation.display,
        durationMs: Date.now() - startedAt,
        error: adapter.error ?? 'LLM adapter failed to create the changelog entry.',
      };
    }

    let changelogFile: string | null = null;
    let title: string | null = null;

    if (changelogConfig.format === 'openchangelog') {
      const afterReleaseNotes = listReleaseNotes(changelogPath);
      const created = [...afterReleaseNotes].filter((file) => !beforeReleaseNotes.has(file)).sort();
      if (created.length === 0) {
        throw new Error(
          `LLM adapter completed but did not create a new release note under ${changelogConfig.path}.`
        );
      }
      const newFile = created.at(-1)!;
      changelogFile = path.join(changelogConfig.path, newFile);
      try {
        title = markdownFrontmatterTitle(readFileSync(path.join(changelogPath!, newFile), 'utf8'));
      } catch {
        title = null;
      }
    } else {
      const afterChangelog = changelogPath && existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : '';
      if (afterChangelog === beforeChangelog) {
        throw new Error(`LLM adapter completed but did not modify ${changelogConfig.path}.`);
      }
      changelogFile = changelogConfig.path;
    }

    return {
      ...baseResult,
      status: 'created',
      changelogFile,
      title,
      adapterCommand: adapter.invocation.display,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
