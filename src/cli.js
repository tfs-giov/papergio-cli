#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { confirmPrompt, option, selectPrompt } from './prompts.js';
import { inspectProject } from './inspect.js';
import { doctor } from './doctor.js';
import { connectProject } from './connect.js';
import { verifyProject } from './verify.js';
import { getTemplate, listTemplates } from './templates/index.js';
import { FoundryError, formatError } from './errors.js';

const VERSION = '0.1.0';
const args = process.argv.slice(2);
const command = args[0];
const projectName = args[1];
const hasFlag = (flag) => args.includes(flag);
const valueOf = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const help = () => console.log(`Papergio CLI ${VERSION}

Usage:
  papergio init <project-name> [--preset saas] [--ui shadcn|tailwind|minimal|none] [--supabase-base-port 54321]
  papergio verify [--json]
  papergio inspect [--json]
  papergio doctor [--json]
  papergio connect [git|supabase|vercel|github] [--link] [--yes] [--json]

The internal foundation classifier is Foundry. The generated project manifest is papergio.yaml.

Examples:
  papergio init my-app
  papergio init my-app --ui minimal --yes
  papergio verify --json`);

function portAvailable(port) {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once('error', () => resolvePort(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolvePort(true)));
  });
}

async function findSupabasePorts(base) {
  for (let candidate = base; candidate <= 65000 - 7; candidate += 10) {
    const ports = [candidate, candidate + 1, candidate + 2, candidate + 3, candidate + 6, candidate - 1];
    if ((await Promise.all(ports.map(portAvailable))).every(Boolean)) {
      return { api: candidate, db: candidate + 1, studio: candidate + 2, mail: candidate + 3, analytics: candidate + 6, shadow: candidate - 1 };
    }
  }
  throw new Error('Could not find a free Supabase port block');
}

async function init() {
  const presetChoices = listTemplates().map((template) => option(template.name, template.description, template.id));
  const preset = valueOf('--preset', hasFlag('--yes') ? 'saas' : await selectPrompt('Choose a foundation:', presetChoices, { defaultValue: 'saas' }));
  let template;
  try { template = getTemplate(preset); } catch (error) { throw new FoundryError(error.message, { code: 'INVALID_PRESET', hint: 'Run "papergio --help" to see supported presets.' }); }
  const ui = valueOf('--ui', hasFlag('--yes') ? 'shadcn' : await selectPrompt('Choose a UI layer:', [option('shadcn', 'Tailwind with neutral components', 'shadcn'), option('tailwind', 'Tailwind without prebuilt components', 'tailwind'), option('minimal', 'Basic neutral CSS', 'minimal'), option('none', 'No UI framework', 'none')], { defaultValue: 'shadcn' }));
  if (!['shadcn', 'tailwind', 'minimal', 'none'].includes(ui)) throw new FoundryError(`Unsupported UI provider: ${ui}`, { code: 'INVALID_UI', hint: 'Choose shadcn, tailwind, minimal, or none.' });
  const basePort = Number(valueOf('--supabase-base-port', '54321'));
  if (!Number.isInteger(basePort) || basePort < 1024 || basePort > 65000) throw new FoundryError('Supabase base port must be an integer between 1024 and 65000.', { code: 'INVALID_PORT', hint: 'Use --supabase-base-port with a valid local TCP port.' });
  const supabasePorts = await findSupabasePorts(basePort);
  if (!projectName || projectName.startsWith('--')) throw new FoundryError('A project name is required.', { code: 'MISSING_PROJECT_NAME', hint: 'Run "papergio init <project-name>".' });
  const target = resolve(process.cwd(), projectName);
  if (existsSync(target)) throw new FoundryError(`Target already exists: ${target}`, { code: 'TARGET_EXISTS', hint: 'Choose another name or remove the existing directory manually.' });
  const summary = { project: projectName, preset, ui, manifest: 'papergio.yaml', compatibility_manifest: 'foundry.yaml', supabase_ports: supabasePorts, integrations: ['nextjs', 'supabase', 'vercel', 'git'] };
  if (!hasFlag('--yes') && !await confirmPrompt(`\nCreate ${projectName} with the ${preset} preset and ${ui} UI?`)) return;
  let created = false;
  try {
    for (const [file, contents] of Object.entries(template.build(projectName, ui, VERSION, { supabasePorts }))) {
      const destination = join(target, file);
      mkdirSync(join(destination, '..'), { recursive: true });
      writeFileSync(destination, contents);
      created = true;
    }
    execFileSync('git', ['init', '--initial-branch=main'], { cwd: target, stdio: 'ignore' });
  } catch (error) {
    if (created && !existsSync(join(target, '.git'))) rmSync(target, { recursive: true, force: true });
    throw new FoundryError('Project generation failed and the incomplete directory was removed.', { code: 'GENERATION_FAILED', hint: 'Check filesystem permissions and try again.', cause: error });
  }
  const result = { status: 'created', target, ...summary };
  if (hasFlag('--json')) console.log(JSON.stringify(result, null, 2));
  else { console.log(`Created ${projectName} at ${target}`); console.log(`Preset: ${preset} · UI: ${ui}`); console.log('\nNext steps:'); console.log(`  cd ${projectName}`); console.log('  npm install'); console.log('  npm run verify'); console.log('  git add . && git commit -m "chore: initialize papergio app"'); }
}

if (command === '--help' || command === undefined) { help(); process.exit(0); }
if (command === 'verify') { try { process.exit(verifyProject(resolve(process.cwd()), hasFlag('--json')) ? 0 : 1); } catch (error) { console.error(formatError(error)); process.exit(1); } }
if (command === 'inspect') { try { process.exit(inspectProject(resolve(process.cwd()), hasFlag('--json')) ? 0 : 1); } catch (error) { console.error(formatError(error)); process.exit(1); } }
if (command === 'doctor') { try { process.exit(doctor(resolve(process.cwd()), hasFlag('--json')) ? 0 : 1); } catch (error) { console.error(formatError(error)); process.exit(1); } }
if (command === 'connect') {
  try {
    const provider = projectName && !projectName.startsWith('--') ? projectName : undefined;
    const success = await connectProject(resolve(process.cwd()), provider, args, hasFlag('--json'));
    process.exit(success ? 0 : 1);
  } catch (error) { console.error(formatError(error)); process.exit(1); }
}
if (command !== 'init' || !projectName) { help(); process.exit(1); }

init().catch((error) => { console.error(formatError(error)); process.exit(1); });
