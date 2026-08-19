import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { findManifest } from './manifest.js';

function commandAvailable(command, args = ['--version']) {
  try {
    execFileSync(command, args, { stdio: 'ignore', shell: command.endsWith('.cmd') });
    return true;
  } catch {
    return false;
  }
}

export function doctor(target, json = false) {
  const manifest = findManifest(target);
  const checks = {
    node: Boolean(process.versions.node),
    npm: commandAvailable(process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    git: commandAvailable(process.platform === 'win32' ? 'git.exe' : 'git'),
    papergio_manifest: manifest?.file === 'papergio.yaml',
    foundry_manifest: Boolean(manifest),
    dependencies: existsSync(join(target, 'node_modules'))
  };
  const result = { status: Object.values(checks).every(Boolean) ? 'ready' : 'attention', checks };
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(`${result.status === 'ready' ? '✓' : '!'} Environment ${result.status}.\n${Object.entries(checks).map(([key, value]) => `  ${value ? '✓' : '✗'} ${key}`).join('\n')}`);
  return result.status === 'ready';
}
