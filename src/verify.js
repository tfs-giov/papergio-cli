import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { findManifest } from './manifest.js';

function commandAvailable(command) {
  try { execFileSync(command, ['--version'], { stdio: 'ignore', shell: command.endsWith('.cmd') }); return true; } catch { return false; }
}

function hasGitRemote(target) {
  try { return Boolean(execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['remote', 'get-url', 'origin'], { cwd: target, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { return false; }
}

function requiredEnvKeys(target) {
  const file = join(target, '.env.example');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean);
}

function configuredEnv(target) {
  const file = join(target, '.env.local');
  if (!existsSync(file)) return false;
  const values = new Map(readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.+)$/)).filter(Boolean).map(([, key, value]) => [key, value.trim()]));
  return requiredEnvKeys(target).every((key) => values.has(key) && values.get(key));
}

function connectionState(target, provider) {
  const file = join(target, '.foundry', 'connections.json');
  if (!existsSync(file)) return false;
  try { return JSON.parse(readFileSync(file, 'utf8')).providers?.[provider]?.connected === true; } catch { return false; }
}

function compatibilityManifestIsSynced(target, manifest) {
  if (!manifest || manifest.file !== 'papergio.yaml') return true;
  const legacyPath = join(target, 'foundry.yaml');
  if (!existsSync(legacyPath)) return true;
  try { return readFileSync(manifest.path, 'utf8') === readFileSync(legacyPath, 'utf8'); } catch { return false; }
}

function buildProject(target, packageJson) {
  if (!existsSync(join(target, 'node_modules'))) return { status: 'skipped', reason: 'dependencies-not-installed' };
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    execFileSync(npm, ['run', packageJson.scripts?.verify ? 'verify' : 'build'], { cwd: target, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    return { status: 'passed' };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().split(/\r?\n/).slice(-12).join('\n');
    return { status: 'failed', output };
  }
}

export function verifyProject(target, json = false) {
  const required = ['package.json', 'AGENTS.md', '.env.example', 'next.config.ts', 'src/app/page.tsx'];
  const missing = required.filter((file) => !existsSync(join(target, file)));
  const manifest = findManifest(target);
  if (!manifest) missing.push('papergio.yaml (or foundry.yaml)');
  if (missing.length) {
    const result = { status: 'failed', checks: {}, warnings: [], missing };
    if (json) console.log(JSON.stringify(result, null, 2)); else console.error(`Verification failed. Missing: ${missing.join(', ')}`);
    return false;
  }
  const packageJson = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
  const checks = {
    manifest: Boolean(manifest),
    papergio_manifest: manifest?.file === 'papergio.yaml',
    compatibility_manifest_synced: compatibilityManifestIsSynced(target, manifest),
    agents_instructions: existsSync(join(target, 'AGENTS.md')),
    environment_template: existsSync(join(target, '.env.example')),
    environment_configured: configuredEnv(target),
    dependencies_installed: existsSync(join(target, 'node_modules')),
    nextjs: Boolean(packageJson.dependencies?.next),
    supabase: Boolean(packageJson.dependencies?.['@supabase/ssr']),
    supabase_cli: commandAvailable(process.platform === 'win32' ? 'supabase.exe' : 'supabase') || existsSync(join(target, 'supabase', '.temp', 'start-secrets')),
    supabase_local: existsSync(join(target, 'supabase', '.temp', 'start-secrets')),
    supabase_linked: connectionState(target, 'supabase') || existsSync(join(target, 'supabase', '.temp', 'project-ref')),
    migrations_present: existsSync(join(target, 'supabase', 'migrations')) && readdirSync(join(target, 'supabase', 'migrations')).some((file) => file.endsWith('.sql')),
    vercel: existsSync(join(target, 'vercel.json')),
    vercel_cli: commandAvailable(process.platform === 'win32' ? 'vercel.cmd' : 'vercel'),
    vercel_linked: existsSync(join(target, '.vercel', 'project.json')) || connectionState(target, 'vercel'),
    git: existsSync(join(target, '.git')),
    git_remote: hasGitRemote(target),
    auth_pages: existsSync(join(target, 'src/app/(auth)/login/page.tsx')),
    dashboard: existsSync(join(target, 'src/app/(app)/dashboard/page.tsx')),
    server_auth: existsSync(join(target, 'src/lib/supabase/server.ts')),
    route_protection: existsSync(join(target, 'src/proxy.ts')),
    permissions: existsSync(join(target, 'src/lib/permissions/require-admin.ts')),
    auth_migration: existsSync(join(target, 'supabase/migrations/20260817000000_initial.sql'))
  };
  const build = buildProject(target, packageJson);
  const critical = ['manifest', 'compatibility_manifest_synced', 'agents_instructions', 'environment_template', 'nextjs', 'supabase', 'vercel', 'git', 'auth_pages', 'dashboard', 'server_auth', 'route_protection', 'permissions', 'auth_migration'];
  const warnings = Object.entries(checks).filter(([key, value]) => !value && !critical.includes(key)).map(([key]) => key);
  if (build.status === 'failed') warnings.push('build');
  const status = critical.every((key) => checks[key]) && build.status !== 'failed' ? 'passed' : 'failed';
  const result = { status, checks, build, warnings };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${status === 'passed' ? '✓' : '✗'} Foundry project ${status}.`);
    console.log(Object.entries(checks).map(([key, value]) => `  ${value ? '✓' : '⚠'} ${key}`).join('\n'));
    console.log(`  ${build.status === 'passed' ? '✓' : build.status === 'skipped' ? '⚠' : '✗'} build: ${build.status}${build.reason ? ` (${build.reason})` : ''}`);
    if (warnings.length) console.log(`\nWarnings: ${warnings.join(', ')}`);
  }
  return status === 'passed';
}
