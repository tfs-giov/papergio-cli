import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { confirmPrompt, option, selectPrompt } from './prompts.js';
import { FoundryError } from './errors.js';

const PROVIDERS = {
  git: { label: 'Git', description: 'Local repository and main branch', command: process.platform === 'win32' ? 'git.exe' : 'git' },
  supabase: { label: 'Supabase', description: 'Database, Auth, and migrations', command: process.platform === 'win32' ? 'supabase.exe' : 'supabase' },
  vercel: { label: 'Vercel', description: 'Deployment and environment variables', command: process.platform === 'win32' ? 'vercel.cmd' : 'vercel' },
  github: { label: 'GitHub', description: 'Remote repository and CI', command: process.platform === 'win32' ? 'gh.exe' : 'gh' }
};

function hasCommand(command) {
  try { execFileSync(command, ['--version'], { stdio: 'ignore', shell: command.endsWith('.cmd') }); return true; } catch { return false; }
}

function loadState(target) {
  const file = join(target, '.foundry', 'connections.json');
  if (!existsSync(file)) return { version: 1, providers: {} };
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return { version: 1, providers: {} }; }
}

function saveState(target, state) {
  const directory = join(target, '.foundry');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'connections.json'), `${JSON.stringify(state, null, 2)}\n`);
}

function statusFor(provider, target, state) {
  const definition = PROVIDERS[provider];
  const installed = provider === 'git' ? existsSync(join(target, '.git')) : hasCommand(definition.command);
  const authenticated = provider === 'git' || (provider === 'supabase' && Boolean(process.env.SUPABASE_ACCESS_TOKEN)) || (provider === 'vercel' && Boolean(process.env.VERCEL_TOKEN)) || (provider === 'github' && Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN));
  return { provider, installed, authenticated, connected: state.providers[provider]?.connected === true };
}

function execute(provider, target, state, { link, applyMigrations, createRepo, push, repository }) {
  const definition = PROVIDERS[provider];
  if (provider === 'git') {
    state.providers.git = { connected: existsSync(join(target, '.git')), updated_at: new Date().toISOString() };
    return 'connected';
  }
  if (!hasCommand(definition.command)) return 'needs-install';
  let acted = false;
  if (provider === 'supabase' && link) {
    const projectId = process.env.SUPABASE_PROJECT_ID;
    if (!projectId) return 'needs-project-id';
    execFileSync(definition.command, ['link', '--project-ref', projectId], { cwd: target, stdio: 'inherit' });
    if (applyMigrations) execFileSync(definition.command, ['db', 'push'], { cwd: target, stdio: 'inherit' });
    acted = true;
  }
  if (provider === 'vercel' && link) { execFileSync(definition.command, ['link', '--yes'], { cwd: target, stdio: 'inherit', shell: definition.command.endsWith('.cmd') }); acted = true; }
  if (provider === 'github' && createRepo) {
    if (!repository) return 'needs-repository';
    execFileSync(definition.command, ['repo', 'create', repository, '--private', '--source', '.', '--remote', 'origin'], { cwd: target, stdio: 'inherit' });
    if (push) execFileSync('git', ['push', '--set-upstream', 'origin', 'main'], { cwd: target, stdio: 'inherit' });
    acted = true;
  }
  if (!acted) return 'ready-to-connect';
  state.providers[provider] = { connected: true, updated_at: new Date().toISOString() };
  return 'connected';
}

export async function connectProject(target, providerArg, args, json = false) {
  if (providerArg && !PROVIDERS[providerArg]) throw new FoundryError(`Unsupported provider: ${providerArg}`, { code: 'UNSUPPORTED_PROVIDER', hint: `Choose one of: ${Object.keys(PROVIDERS).join(', ')}.` });
  const selected = providerArg ? [providerArg] : (args.includes('--yes') ? Object.keys(PROVIDERS) : (await selectPrompt('Which services do you want to connect?', Object.entries(PROVIDERS).map(([id, provider]) => option(provider.label, provider.description, id)), { multi: true, defaultValue: 'git' })));
  const providers = Array.isArray(selected) ? selected : [selected];
  const state = loadState(target);
  const statuses = providers.map((provider) => statusFor(provider, target, state));
  const hasActions = args.includes('--link') || args.includes('--apply-migrations') || args.includes('--create-repo');
  if (hasActions && !args.includes('--yes')) {
    const summary = statuses.map((item) => `${item.provider}: ${item.installed ? 'CLI available' : 'CLI missing'}`).join(', ');
    if (!await confirmPrompt(`Run connection steps for ${summary}?`)) return false;
  }
  const results = statuses.map((item) => {
    try {
      return { ...item, result: execute(item.provider, target, state, { link: args.includes('--link'), applyMigrations: args.includes('--apply-migrations'), createRepo: args.includes('--create-repo'), push: args.includes('--push'), repository: args[args.indexOf('--repo') + 1] }) };
    } catch (error) {
      return { ...item, result: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
  });
  saveState(target, state);
  const output = { status: results.every((item) => ['connected', 'ready-to-connect', 'needs-install', 'needs-project-id', 'needs-repository'].includes(item.result)) ? 'completed' : 'failed', target, providers: results };
  if (json) console.log(JSON.stringify(output, null, 2));
  else {
    console.log('Connection status:');
    results.forEach((item) => console.log(`  ${item.result === 'connected' ? '✓' : '!'} ${item.provider}: ${item.result}${item.error ? ` — ${item.error}` : ''}`));
    console.log('\nState saved to .foundry/connections.json');
  }
  return output.status === 'completed';
}
