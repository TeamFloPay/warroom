import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type RepoManifest } from './repos.js';
import { type ResourcesManifest } from './resources.js';

function noteBlock(repoId: string, existing: string | null) {
  const pattern = new RegExp(
    `<!-- warroom:notes:start repo=${repoId} -->[\\s\\S]*?<!-- warroom:notes:end repo=${repoId} -->`
  );
  const match = existing?.match(pattern);
  if (match) return match[0];

  return [
    `<!-- warroom:notes:start repo=${repoId} -->`,
    `<!-- Add hand-written ${repoId} notes here. This block is preserved by atlas regeneration. -->`,
    `<!-- warroom:notes:end repo=${repoId} -->`,
  ].join('\n');
}

function resourceNames(resourceIds: string[], resources: ResourcesManifest) {
  const byId = new Map(resources.resources.map((resource) => [resource.id, resource.name]));
  return resourceIds.map((id) => byId.get(id) ?? id);
}

export function generateCampaignAtlas(manifest: RepoManifest, resources: ResourcesManifest, existing: string | null) {
  const lines: string[] = [
    '# Campaign Atlas',
    '',
    'This atlas is the human-readable view of `repos.yaml`. The YAML manifest is the machine-readable source of truth for repo ownership, local paths, specialist context, and resource allowlists.',
    '',
    'War Room owns coordination. Child repositories own code.',
    '',
    '## Repo Map',
    '',
    '| Repo | Status | Local path | Sergeant | Notes |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const repo of manifest.repos) {
    lines.push(
      `| \`${repo.github}\` | ${repo.status} | \`${repo.local_path}\` | ${repo.specialist.name} | ${repo.description} |`
    );
  }

  lines.push(
    '',
    '## Ownership Boundaries',
    '',
    '- War Room owns repo maps, local command orchestration, company-level agent guidance, local run artifacts, and workflow helpers.',
    '- Child repositories own product source, product tests, package publishing, deployable infrastructure, and repo-specific documentation.',
    '- Product edits produced during a War Room workflow are committed in the owning child repository, not in War Room.',
    '',
    '## Territory Snapshot',
    '',
    '- Known territory is tracked in `maps/issue-territory.md` and the Campaign Map project.',
    '- Blurry territory starts in `needs-triage` and moves to `ready-to-engage` after a scoped battle plan exists.',
    '- Unmapped territory should become a GitHub issue before implementation unless it is a tiny local War Room maintenance task.',
    '',
    '## Specialist Context',
    ''
  );

  for (const repo of manifest.repos) {
    const resourcesList = resourceNames(repo.specialist.context.resources, resources);
    lines.push(
      `### ${repo.specialist.name}`,
      '',
      `- Repo: \`${repo.github}\``,
      `- Owner: \`${repo.owner}\``,
      `- Focus: ${repo.specialist.context.domains.length ? repo.specialist.context.domains.join(', ') : repo.description}`,
      `- Frameworks: ${repo.specialist.context.frameworks.length ? repo.specialist.context.frameworks.join(', ') : 'none listed'}`,
      `- Resources: ${resourcesList.length ? resourcesList.join(', ') : 'none listed'}`,
      '',
      noteBlock(repo.id, existing),
      ''
    );
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function readExistingAtlas(workspaceRoot: string) {
  const atlasPath = path.join(workspaceRoot, 'maps', 'campaign-atlas.md');
  return existsSync(atlasPath) ? readFileSync(atlasPath, 'utf8') : null;
}

export function atlasPath(workspaceRoot: string) {
  return path.join(workspaceRoot, 'maps', 'campaign-atlas.md');
}
