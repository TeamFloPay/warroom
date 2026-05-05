import { buildProgram } from '../src/cli.js';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAbort } from '../src/commands/abort.js';
import { runBootstrap } from '../src/commands/bootstrap.js';
import { runCampaignStatusCheck } from '../src/commands/campaign.js';
import { runCommitCreate } from '../src/commands/commit-create.js';
import { runDoctor } from '../src/commands/doctor.js';
import { runDevStatus } from '../src/commands/dev-link.js';
import { runMapsAssign } from '../src/commands/maps-assign.js';
import { runMapsStudy } from '../src/commands/maps-study.js';
import { runSync } from '../src/commands/sync.js';

const workspaceRoot = new URL('..', import.meta.url).pathname;

describe('phase-1 CLI', () => {
  it('loads the repo map', () => {
    const repos = runMapsStudy(workspaceRoot);
    expect(repos.map((repo) => repo.id)).toEqual([
      'sdk',
      'backend',
      'infra',
      'demo',
      'docs',
      'dashboard',
      'landing',
    ]);
  });

  it('passes the skeleton doctor check', () => {
    expect(runDoctor(workspaceRoot).ok).toBe(true);
  }, 30000);

  it('sees the Campaign Map status options', () => {
    const result = runCampaignStatusCheck();

    expect(result.missing).toEqual([]);
    expect(result.options.map((option) => option.name)).toEqual([
      'needs-triage',
      'ready-to-engage',
      'battlefield-active',
      'skirmish',
      'blockaded',
      'victory',
    ]);
  }, 30000);

  it('validates campaign atlas generation state', () => {
    const result = runMapsAssign(workspaceRoot, { check: true });

    expect(result.resourceReferencesOk).toBe(true);
    expect(result.atlasMatches).toBe(true);
  });

  it('prints maps study output', async () => {
    const lines: string[] = [];
    const program = buildProgram({ cwd: workspaceRoot, output: (line) => lines.push(line) });

    await program.parseAsync(['node', 'warroom', 'maps', 'study']);

    expect(lines.some((line) => line.includes('TeamFloPay/sdk'))).toBe(true);
    expect(lines.some((line) => line.includes('TeamFloPay/demo'))).toBe(true);
  });

  it('reports SDK-to-demo link state from sibling checkouts', () => {
    const root = makeDevFixture();

    const status = runDevStatus(root);

    expect(status.sdk.checkedOut).toBe(true);
    expect(status.sdk.source).toBe('sibling');
    expect(status.demo.checkedOut).toBe(true);
    expect(status.linked).toBe(true);
    expect(status.packages.map((pkg) => [pkg.name, pkg.linked])).toEqual([
      ['@flopay/shared', true],
      ['@flopay/js', true],
      ['@flopay/react', true],
      ['@flopay/node', true],
    ]);
  });

  it('prints dev status output', async () => {
    const root = makeDevFixture();
    const lines: string[] = [];
    const program = buildProgram({ cwd: root, output: (line) => lines.push(line) });

    await program.parseAsync(['node', 'warroom', 'dev', 'status']);

    expect(lines.some((line) => line.includes('SDK-to-demo dev link: linked'))).toBe(true);
    expect(lines.some((line) => line.includes('Demo Playwright core:'))).toBe(true);
    expect(lines.some((line) => line.includes('NODE_OPTIONS=--preserve-symlinks'))).toBe(false);
  });

  it('previews bootstrap without cloning sibling checkouts', () => {
    const root = makeDevFixture();

    const result = runBootstrap(root, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.repos.map((repo) => repo.state)).toEqual(['sibling-present', 'sibling-present']);
  });

  it('reports sync state without mutating repos', () => {
    const root = makeDevFixture();

    const result = runSync(root, { report: true });

    expect(result.reportOnly).toBe(true);
    expect(result.repos).toHaveLength(2);
  });

  it('prints preservation-first abort recovery output', () => {
    const root = makeDevFixture();

    const result = runAbort(root);

    expect(result.mutated).toBe(false);
    expect(result.repos.map((repo) => repo.repo)).toEqual(['TeamFloPay/sdk', 'TeamFloPay/demo']);
  });

  it('preflights commit creation with validation artifacts', () => {
    const { root, sdk } = makeCommitFixture();
    mkdirSync(path.join(sdk, 'docs'), { recursive: true });
    writeFileSync(path.join(sdk, 'docs', 'note.md'), 'Commit notes.\n');

    const result = runCommitCreate(root, {
      repo: 'sdk',
      validate: ['node -e "console.log(42)"'],
      writeArtifact: true,
    });

    expect(result.blocked).toEqual([]);
    expect(result.committed).toBe(false);
    expect(result.suggestedMessage).toBe('docs(sdk): update war room workflow');
    expect(result.changes.map((change) => [change.path, change.unstaged])).toEqual([['docs/note.md', true]]);
    expect(result.validation).toHaveLength(1);
    expect(result.validation[0]?.ok).toBe(true);
    expect(result.validation[0]?.stdout).toBe('42');
    expect(result.artifact).toBeDefined();
    expect(existsSync(path.join(result.artifact!.runDir, 'summary.md'))).toBe(true);
    expect(readFileSync(path.join(result.artifact!.runDir, 'summary.md'), 'utf8')).toContain('ok node -e "console.log(42)"');
  });

  it('blocks confirmed commit creation when changes are unstaged and --all is absent', () => {
    const { root, sdk } = makeCommitFixture();
    writeFileSync(path.join(sdk, 'index.ts'), 'export const value = 1;\n');

    expect(() => runCommitCreate(root, { repo: 'sdk', confirm: true })).toThrow(/No staged changes/);
  });

  it('blocks commit creation when validation fails', () => {
    const { root, sdk } = makeCommitFixture();
    writeFileSync(path.join(sdk, 'index.ts'), 'export const value = 1;\n');

    const result = runCommitCreate(root, { repo: 'sdk', validate: ['node -e "process.exit(7)"'] });

    expect(result.validation[0]?.ok).toBe(false);
    expect(result.validation[0]?.status).toBe(7);
    expect(result.blocked).toContain('Validation failed: node -e "process.exit(7)"');
  });
});

function makeDevFixture() {
  const base = mkdtempSync(path.join(tmpdir(), 'warroom-dev-'));
  const root = path.join(base, 'warroom');
  const sdk = path.join(base, 'sdk');
  const demo = path.join(base, 'demo');

  mkdirSync(root, { recursive: true });
  mkdirSync(path.join(root, 'maps', 'repos'), { recursive: true });
  mkdirSync(path.join(sdk, '.git'), { recursive: true });
  mkdirSync(path.join(demo, '.git'), { recursive: true });
  mkdirSync(path.join(demo, 'node_modules', '@flopay'), { recursive: true });

  writeFileSync(
    path.join(root, 'repos.yaml'),
    `version: 1
defaults:
  owner: TeamFloPay
  clone_protocol: ssh
  default_branch: main
  local_root: maps/repos
repos:
  - id: sdk
    name: sdk
    github: TeamFloPay/sdk
    ssh_url: git@github.com:TeamFloPay/sdk.git
    local_path: maps/repos/sdk
    status: active
    owner: sdk
    description: SDK packages.
    specialist:
      name: SDK Sergeant
      context:
        frameworks: []
        domains: []
        resources: []
  - id: demo
    name: demo
    github: TeamFloPay/demo
    ssh_url: git@github.com:TeamFloPay/demo.git
    local_path: maps/repos/demo
    status: active
    owner: demo
    description: Demo app.
    specialist:
      name: Demo Sergeant
      context:
        frameworks: []
        domains: []
        resources: []
`
  );

  writeFileSync(path.join(sdk, 'package.json'), '{"packageManager":"pnpm@9.15.0"}\n');
  writeFileSync(path.join(demo, 'package.json'), '{"packageManager":"pnpm@9.15.0"}\n');

  for (const packageName of ['shared', 'js', 'react', 'node']) {
    const packagePath = path.join(sdk, 'packages', packageName);
    const mirrorPath = path.join(root, '.warroom', 'dev', 'sdk-packages', packageName);
    mkdirSync(path.join(packagePath, 'dist'), { recursive: true });
    mkdirSync(path.join(mirrorPath, 'dist'), { recursive: true });
    writeFileSync(path.join(packagePath, 'package.json'), `{"name":"@flopay/${packageName}"}\n`);
    writeFileSync(path.join(packagePath, 'dist', 'index.mjs'), '');
    writeFileSync(path.join(mirrorPath, 'package.json'), `{"name":"@flopay/${packageName}"}\n`);
    symlinkSync(mirrorPath, path.join(demo, 'node_modules', '@flopay', packageName), 'dir');
  }

  return root;
}

function makeCommitFixture() {
  const base = mkdtempSync(path.join(tmpdir(), 'warroom-commit-'));
  const root = path.join(base, 'warroom');
  const sdk = path.join(base, 'sdk');
  const demo = path.join(base, 'demo');

  mkdirSync(root, { recursive: true });
  mkdirSync(path.join(root, 'maps', 'repos'), { recursive: true });
  initGitRepo(sdk);
  initGitRepo(demo);

  writeFileSync(
    path.join(root, 'repos.yaml'),
    `version: 1
defaults:
  owner: TeamFloPay
  clone_protocol: ssh
  default_branch: main
  local_root: maps/repos
repos:
  - id: sdk
    name: sdk
    github: TeamFloPay/sdk
    ssh_url: git@github.com:TeamFloPay/sdk.git
    local_path: maps/repos/sdk
    status: active
    owner: sdk
    description: SDK packages.
    specialist:
      name: SDK Sergeant
      context:
        frameworks: []
        domains: []
        resources: []
  - id: demo
    name: demo
    github: TeamFloPay/demo
    ssh_url: git@github.com:TeamFloPay/demo.git
    local_path: maps/repos/demo
    status: active
    owner: demo
    description: Demo app.
    specialist:
      name: Demo Sergeant
      context:
        frameworks: []
        domains: []
        resources: []
`
  );

  return { root, sdk, demo };
}

function initGitRepo(repoPath: string) {
  mkdirSync(repoPath, { recursive: true });
  const init = spawnSync('git', ['init', '-b', 'main'], { cwd: repoPath, encoding: 'utf8' });
  if (init.status !== 0) throw new Error(init.stderr);
  spawnSync('git', ['config', 'user.email', 'warroom@example.com'], { cwd: repoPath });
  spawnSync('git', ['config', 'user.name', 'War Room'], { cwd: repoPath });
}
