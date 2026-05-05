import { spawnSync } from 'node:child_process';
import { type RepoManifest } from './repos.js';

export const CAMPAIGN_LABELS = [
  { name: 'needs-triage', color: 'D4C5F9', description: 'Blurry territory that needs planning before execution.' },
  { name: 'ready-to-engage', color: '0E8A16', description: 'Planned work ready for implementation.' },
  { name: 'battlefield-active', color: '1D76DB', description: 'Work is actively being implemented.' },
  { name: 'skirmish', color: 'FBCA04', description: 'PR review, CodeRabbit feedback, or follow-up changes are being handled.' },
  { name: 'blockaded', color: 'B60205', description: 'Work is blocked by an external dependency, decision, access issue, or prerequisite.' },
  { name: 'victory', color: '5319E7', description: 'Work is merged, cleaned up, and reported.' },
] as const;

export type CampaignLabelReport = {
  checked: boolean;
  expected: typeof CAMPAIGN_LABELS;
  missing: Array<{ repo: string; label: string }>;
  errors: Array<{ repo: string; detail: string }>;
  createPlan: string[];
};

export function checkCampaignLabels(manifest: RepoManifest): CampaignLabelReport {
  const missing: CampaignLabelReport['missing'] = [];
  const errors: CampaignLabelReport['errors'] = [];
  const createPlan: string[] = [];

  for (const repo of manifest.repos) {
    const result = spawnSync('gh', ['label', 'list', '--repo', repo.github, '--json', 'name', '--limit', '100'], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      errors.push({ repo: repo.github, detail: `${result.stderr || result.stdout}`.trim() });
      continue;
    }

    let labels: Array<{ name?: string }>;
    try {
      labels = JSON.parse(result.stdout || '[]') as Array<{ name?: string }>;
    } catch {
      errors.push({ repo: repo.github, detail: 'Could not parse gh label list output.' });
      continue;
    }
    const existing = new Set(labels.map((label) => label.name).filter(Boolean));
    for (const label of CAMPAIGN_LABELS) {
      if (!existing.has(label.name)) {
        missing.push({ repo: repo.github, label: label.name });
        createPlan.push(
          `gh label create ${label.name} --repo ${repo.github} --color ${label.color} --description "${label.description}"`
        );
      }
    }
  }

  return {
    checked: errors.length === 0,
    expected: CAMPAIGN_LABELS,
    missing,
    errors,
    createPlan,
  };
}
