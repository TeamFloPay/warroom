import { writeFileSync } from 'node:fs';
import { atlasPath, generateCampaignAtlas, readExistingAtlas } from '../lib/atlas.js';
import { loadRepoManifest, writeRepoManifest } from '../lib/repos.js';
import { loadResourcesManifest, validateResourceReferences, writeResourcesManifest } from '../lib/resources.js';

export type MapsAssignOptions = {
  repo?: string;
  sergeant?: string;
  addFramework?: string[];
  removeFramework?: string[];
  addDomain?: string[];
  removeDomain?: string[];
  addResource?: string[];
  removeResource?: string[];
  resourceId?: string;
  resourceType?: string;
  resourceName?: string;
  resourceDescription?: string;
  resourceDocsUrl?: string;
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
  let resourcesChanged = false;

  if (options.resourceId) {
    const existing = resources.resources.find((resource) => resource.id === options.resourceId);
    const nextResource: {
      id: string;
      type: string;
      name: string;
      description: string;
      docs_url?: string;
    } = {
      id: options.resourceId,
      type: options.resourceType ?? existing?.type ?? 'docs',
      name: options.resourceName ?? existing?.name ?? options.resourceId,
      description: options.resourceDescription ?? existing?.description ?? 'Logical War Room resource; fill in a clearer description before relying on it.',
    };
    const docsUrl = options.resourceDocsUrl ?? existing?.docs_url;
    if (docsUrl) nextResource.docs_url = docsUrl;

    if (existing) {
      if (
        existing.type !== nextResource.type ||
        existing.name !== nextResource.name ||
        existing.description !== nextResource.description ||
        existing.docs_url !== nextResource.docs_url
      ) {
        Object.assign(existing, nextResource);
        messages.push(`Update resource definition ${options.resourceId}`);
        resourcesChanged = true;
      }
    } else {
      resources.resources = [...resources.resources, nextResource].sort((left, right) => left.id.localeCompare(right.id));
      messages.push(`Add resource definition ${options.resourceId}`);
      resourcesChanged = true;
    }
  }

  if (options.repo) {
    const repo = manifest.repos.find((entry) => entry.id === options.repo);
    if (!repo) throw new Error(`Unknown repo "${options.repo}".`);

    if (options.sergeant && repo.specialist.name !== options.sergeant) {
      messages.push(`Sergeant rename: ${repo.specialist.name} -> ${options.sergeant}`);
      repo.specialist.name = options.sergeant;
      changed = true;
    }

    for (const framework of options.addFramework ?? []) {
      if (!repo.specialist.context.frameworks.includes(framework)) {
        repo.specialist.context.frameworks = sortedUnique([...repo.specialist.context.frameworks, framework]);
        messages.push(`Add framework ${framework} to ${repo.id}`);
        changed = true;
      }
    }

    for (const framework of options.removeFramework ?? []) {
      if (repo.specialist.context.frameworks.includes(framework)) {
        repo.specialist.context.frameworks = repo.specialist.context.frameworks.filter((value) => value !== framework);
        messages.push(`Remove framework ${framework} from ${repo.id}`);
        changed = true;
      }
    }

    for (const domain of options.addDomain ?? []) {
      if (!repo.specialist.context.domains.includes(domain)) {
        repo.specialist.context.domains = sortedUnique([...repo.specialist.context.domains, domain]);
        messages.push(`Add domain ${domain} to ${repo.id}`);
        changed = true;
      }
    }

    for (const domain of options.removeDomain ?? []) {
      if (repo.specialist.context.domains.includes(domain)) {
        repo.specialist.context.domains = repo.specialist.context.domains.filter((value) => value !== domain);
        messages.push(`Remove domain ${domain} from ${repo.id}`);
        changed = true;
      }
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
    if (resourcesChanged) writeResourcesManifest(workspaceRoot, resources);
    if (!atlasMatches || changed || resourcesChanged) writeFileSync(atlasPath(workspaceRoot), nextAtlas);
    messages.push('Wrote repo/resource assignment changes and regenerated campaign atlas.');
  } else if (changed || resourcesChanged || !atlasMatches) {
    messages.push('Dry run only. Pass --write to update repos.yaml, resources.yaml, and maps/campaign-atlas.md.');
  }

  if (options.check && atlasMatches && references.ok) {
    messages.push('Campaign atlas and resource references are valid.');
  }

  return {
    changed: changed || resourcesChanged,
    atlasMatches: options.write ? true : atlasMatches,
    resourceReferencesOk: references.ok,
    missingResources: references.missing,
    messages,
    atlasPath: atlasPath(workspaceRoot),
  };
}
