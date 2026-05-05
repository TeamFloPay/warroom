import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type RunArtifact = {
  runDir: string;
  files: string[];
};

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '');
}

export function createRunArtifact(workspaceRoot: string, commandName: string, files: Record<string, string>): RunArtifact {
  const runDir = path.join(workspaceRoot, '.warroom', 'runs', `${safeTimestamp()}-${commandName}`);
  mkdirSync(runDir, { recursive: true });
  const writtenFiles: string[] = [];

  for (const [fileName, content] of Object.entries(files)) {
    const filePath = path.join(runDir, fileName);
    writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`);
    writtenFiles.push(filePath);
  }

  return { runDir, files: writtenFiles };
}
