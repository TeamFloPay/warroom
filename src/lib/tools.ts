import { spawnSync } from 'node:child_process';

export type ToolCheck = {
  name: string;
  command: string;
  args: string[];
  ok: boolean;
  detail: string | null;
};

export function checkTool(name: string, command: string, args: string[]): ToolCheck {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return {
    name,
    command,
    args,
    ok: result.status === 0,
    detail: output.split(/\r?\n/).filter(Boolean)[0] ?? null,
  };
}

export function checkGithubAuth(): ToolCheck {
  return checkTool('GitHub auth', 'gh', ['auth', 'status']);
}
