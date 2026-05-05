import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { checkTool, type ToolCheck } from '../lib/tools.js';
import { getRepoHealth, loadRepoManifest, writeRepoManifest, type RepoEntry, type RepoHealth } from '../lib/repos.js';
import { loadResourcesManifest, writeResourcesManifest, type ResourceEntry } from '../lib/resources.js';

export type BootstrapOptions = {
  dryRun?: boolean;
  includePlanned?: boolean;
  writeProposals?: boolean;
  confirm?: boolean;
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
  resourceProposals: BootstrapResourceProposal[];
  proposalsApplied: boolean;
  ok: boolean;
};

export type BootstrapResourceProposal = {
  repo: string;
  resource: string;
  action: 'allowlist' | 'define-resource';
  reason: string;
};

function cloneRepo(repo: RepoHealth) {
  mkdirSync(dirname(repo.configuredPath), { recursive: true });
  return spawnSync('git', ['clone', repo.ssh_url, repo.configuredPath], { encoding: 'utf8' });
}

const RESOURCE_RULES: Array<{ resource: string; pattern: RegExp; reason: string }> = [
  { resource: 'github-cli', pattern: /github|issue|pr|pull request/i, reason: 'GitHub workflow operations' },
  { resource: 'typescript-docs', pattern: /typescript|tsup|turborepo|next\.js|nestjs|react/i, reason: 'TypeScript implementation context' },
  { resource: 'npm-docs', pattern: /npm|pnpm|package|publishing/i, reason: 'Node package management context' },
  { resource: 'nestjs-docs', pattern: /nestjs/i, reason: 'NestJS framework context' },
  { resource: 'stripe-docs', pattern: /stripe|billing|checkout|payment/i, reason: 'Stripe/payment integration context' },
  { resource: 'stripe-api', pattern: /stripe|billing|checkout|payment/i, reason: 'Stripe/payment API context' },
  { resource: 'nextjs-docs', pattern: /next\.js|react|app-/i, reason: 'Next.js application context' },
  { resource: 'playwright-docs', pattern: /playwright|e2e/i, reason: 'Browser testing context' },
  { resource: 'railway-docs', pattern: /railway/i, reason: 'Railway infrastructure context' },
  { resource: 'cloudflare-docs', pattern: /cloudflare|dns/i, reason: 'Cloudflare infrastructure context' },
];

function inferResourceProposals(repos: RepoEntry[], resources: ResourceEntry[]): BootstrapResourceProposal[] {
  const knownResources = new Set(resources.map((resource) => resource.id));
  const proposals: BootstrapResourceProposal[] = [];

  for (const repo of repos) {
    const contextText = [
      repo.id,
      repo.owner,
      repo.description,
      ...repo.specialist.context.frameworks,
      ...repo.specialist.context.domains,
    ].join(' ');
    const allowlist = new Set(repo.specialist.context.resources);

    for (const rule of RESOURCE_RULES) {
      if (rule.pattern.test(contextText) && knownResources.has(rule.resource) && !allowlist.has(rule.resource)) {
        proposals.push({ repo: repo.id, resource: rule.resource, action: 'allowlist', reason: rule.reason });
      }
    }

    for (const resource of repo.specialist.context.resources) {
      if (!knownResources.has(resource)) {
        proposals.push({
          repo: repo.id,
          resource,
          action: 'define-resource',
          reason: `Repo ${repo.id} references ${resource}, but resources.yaml does not define it`,
        });
      }
    }
  }

  return proposals;
}

function applyResourceProposals(repos: RepoEntry[], resources: ResourceEntry[], proposals: BootstrapResourceProposal[]) {
  const knownResources = new Set(resources.map((resource) => resource.id));
  let resourcesChanged = false;

  for (const proposal of proposals) {
    if (proposal.action === 'allowlist') {
      const repo = repos.find((entry) => entry.id === proposal.repo);
      if (repo && !repo.specialist.context.resources.includes(proposal.resource)) {
        repo.specialist.context.resources = [...repo.specialist.context.resources, proposal.resource].sort();
      }
    } else if (!knownResources.has(proposal.resource)) {
      resources.push({
        id: proposal.resource,
        type: 'docs',
        name: proposal.resource,
        description: `Placeholder resource inferred by bootstrap for ${proposal.repo}; replace with a clearer non-secret description.`,
      });
      knownResources.add(proposal.resource);
      resourcesChanged = true;
    }
  }

  resources.sort((left, right) => left.id.localeCompare(right.id));
  return resourcesChanged;
}

export function runBootstrap(workspaceRoot: string, options: BootstrapOptions = {}): BootstrapResult {
  const manifest = loadRepoManifest(workspaceRoot);
  const resources = loadResourcesManifest(workspaceRoot);
  const tools = [
    checkTool('git', 'git', ['--version']),
    checkTool('gh', 'gh', ['--version']),
    checkTool('node', 'node', ['--version']),
    checkTool('npm', 'npm', ['--version']),
  ];

  const repos: BootstrapRepoAction[] = [];
  const resourceProposals = inferResourceProposals(manifest.repos, resources.resources);
  let proposalsApplied = false;

  if (options.writeProposals && options.confirm && resourceProposals.length > 0) {
    const resourcesChanged = applyResourceProposals(manifest.repos, resources.resources, resourceProposals);
    writeRepoManifest(workspaceRoot, manifest);
    if (resourcesChanged) writeResourcesManifest(workspaceRoot, resources);
    proposalsApplied = true;
  }

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
    resourceProposals,
    proposalsApplied,
    ok: tools.every((tool) => tool.ok) && repos.every((repo) => repo.state !== 'failed'),
  };
}
