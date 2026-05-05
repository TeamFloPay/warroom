import { readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { type RepoManifest } from './repos.js';

const ResourceSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  description: z.string(),
  docs_url: z.string().url().optional(),
});

const ResourcesSchema = z.object({
  version: z.number(),
  resources: z.array(ResourceSchema),
});

export type ResourceEntry = z.infer<typeof ResourceSchema>;
export type ResourcesManifest = z.infer<typeof ResourcesSchema>;

export function loadResourcesManifest(workspaceRoot: string): ResourcesManifest {
  const resourcesPath = path.join(workspaceRoot, 'resources.yaml');
  const raw = readFileSync(resourcesPath, 'utf8');
  return ResourcesSchema.parse(YAML.parse(raw));
}

export function validateResourceReferences(manifest: RepoManifest, resources: ResourcesManifest) {
  const resourceIds = new Set(resources.resources.map((resource) => resource.id));
  const missing: Array<{ repo: string; resource: string }> = [];

  for (const repo of manifest.repos) {
    for (const resource of repo.specialist.context.resources) {
      if (!resourceIds.has(resource)) missing.push({ repo: repo.id, resource });
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    resourceCount: resources.resources.length,
    referencedResourceCount: new Set(manifest.repos.flatMap((repo) => repo.specialist.context.resources)).size,
  };
}
