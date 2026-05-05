import { writeFileSync } from 'node:fs';
import { atlasPath, generateCampaignAtlas, readExistingAtlas } from '../lib/atlas.js';
import { loadRepoManifest, writeRepoManifest } from '../lib/repos.js';
import { loadResourcesManifest, validateResourceReferences } from '../lib/resources.js';

export type MapsAssignOptions = {
  repo?: string;
  sergeant?: string;
  addResource?: string[];
  removeResource?: string[];
  write?: boolean;
  check?: boolean;
};

export type MapsAssignResult = {
  changed: boolean;
  atlasMatches: boolean;
  resourceReferencesOk: boolean;
  missingResources: Array<{ repo: string; resource: string }>;
  messages: string[];
  atlasPath: string;
};

function sortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

export function runMapsAssign(workspaceRoot: string, options: MapsAssignOptions = {}): MapsAssignResult {
  const manifest = loadRepoManifest(workspaceRoot);
  const resources = loadResourcesManifest(workspaceRoot);
  const messages: string[] = [];
  let changed = false;

  if (options.repo) {
    const repo = manifest.repos.find((entry) => entry.id === options.repo);
    if (!repo) throw new Error(`Unknown repo "${options.repo}".`);

    if (options.sergeant && repo.specialist.name !== options.sergeant) {
      messages.push(`Sergeant rename: ${repo.specialist.name} -> ${options.sergeant}`);
      repo.specialist.name = options.sergeant;
      changed = true;
    }

    for (const resource of options.addResource ?? []) {
      if (!repo.specialist.context.resources.includes(resource)) {
        repo.specialist.context.resources = sortedUnique([...repo.specialist.context.resources, resource]);
        messages.push(`Add resource ${resource} to ${repo.id}`);
        changed = true;
      }
    }

    for (const resource of options.removeResource ?? []) {
      if (repo.specialist.context.resources.includes(resource)) {
        repo.specialist.context.resources = repo.specialist.context.resources.filter((value) => value !== resource);
        messages.push(`Remove resource ${resource} from ${repo.id}`);
        changed = true;
      }
    }
  }

  const existingAtlas = readExistingAtlas(workspaceRoot);
  const nextAtlas = generateCampaignAtlas(manifest, resources, existingAtlas);
  const atlasMatches = existingAtlas === nextAtlas;
  const references = validateResourceReferences(manifest, resources);

  if (options.write) {
    if (changed) writeRepoManifest(workspaceRoot, manifest);
    if (!atlasMatches || changed) writeFileSync(atlasPath(workspaceRoot), nextAtlas);
    messages.push('Wrote repo assignment changes and regenerated campaign atlas.');
  } else if (changed || !atlasMatches) {
    messages.push('Dry run only. Pass --write to update repos.yaml and maps/campaign-atlas.md.');
  }

  if (options.check && atlasMatches && references.ok) {
    messages.push('Campaign atlas and resource references are valid.');
  }

  return {
    changed,
    atlasMatches: options.write ? true : atlasMatches,
    resourceReferencesOk: references.ok,
    missingResources: references.missing,
    messages,
    atlasPath: atlasPath(workspaceRoot),
  };
}
