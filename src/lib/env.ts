import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type EnvStatus = {
  exampleExists: boolean;
  localExists: boolean;
  adapter: string | null;
  adapterSupported: boolean;
  notes: string[];
};

function parseEnv(raw: string) {
  const values = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    values.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }
  return values;
}

export function getEnvStatus(workspaceRoot: string): EnvStatus {
  const examplePath = path.join(workspaceRoot, '.env.example');
  const localPath = path.join(workspaceRoot, '.env.local');
  const exampleExists = existsSync(examplePath);
  const localExists = existsSync(localPath);
  const notes: string[] = [];
  const example = exampleExists ? parseEnv(readFileSync(examplePath, 'utf8')) : new Map<string, string>();
  const local = localExists ? parseEnv(readFileSync(localPath, 'utf8')) : new Map<string, string>();
  const adapter = local.get('LLM_ADAPTER') ?? example.get('LLM_ADAPTER') ?? null;
  const adapterSupported = adapter === 'codex' || adapter === 'claude';

  if (!localExists) notes.push('.env.local is optional but needed before launching LLM adapters.');
  if (!adapterSupported) notes.push('LLM_ADAPTER should be codex or claude.');

  return {
    exampleExists,
    localExists,
    adapter,
    adapterSupported,
    notes,
  };
}

export function getAdapterCommand(workspaceRoot: string) {
  const examplePath = path.join(workspaceRoot, '.env.example');
  const localPath = path.join(workspaceRoot, '.env.local');
  const example = existsSync(examplePath) ? parseEnv(readFileSync(examplePath, 'utf8')) : new Map<string, string>();
  const local = existsSync(localPath) ? parseEnv(readFileSync(localPath, 'utf8')) : new Map<string, string>();
  const adapter = local.get('LLM_ADAPTER') ?? example.get('LLM_ADAPTER') ?? 'codex';
  if (adapter === 'claude') return local.get('CLAUDE_COMMAND') ?? example.get('CLAUDE_COMMAND') ?? 'claude';
  return local.get('CODEX_COMMAND') ?? example.get('CODEX_COMMAND') ?? 'codex';
}
