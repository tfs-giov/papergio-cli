import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const cli = join(root, 'src', 'cli.js');

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('generates every supported UI variant and passes structural verification', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'foundry-test-'));
  try {
    for (const ui of ['shadcn', 'tailwind', 'minimal', 'none']) {
      const result = run(['init', `app-${ui}`, '--preset', 'saas', '--ui', ui, '--yes', '--json'], workspace);
      assert.equal(result.status, 0, result.stderr);
      const project = join(workspace, `app-${ui}`);
      const verify = run(['verify', '--json'], project);
      assert.equal(verify.status, 0, verify.stderr);
      const papergioManifest = readFileSync(join(project, 'papergio.yaml'), 'utf8');
      const manifest = readFileSync(join(project, 'foundry.yaml'), 'utf8');
      assert.match(papergioManifest, /schema: papergio\/v1/);
      assert.equal(papergioManifest, manifest);
      assert.match(manifest, new RegExp(`provider: ${ui}`));
      const supabaseConfig = readFileSync(join(project, 'supabase', 'config.toml'), 'utf8');
      assert.match(supabaseConfig, /project_id = "app-/);
      if (ui === 'shadcn') assert.ok(readFileSync(join(project, 'components.json'), 'utf8').includes('ui.shadcn.com'));
      assert.ok(readFileSync(join(project, 'src', 'proxy.ts'), 'utf8').includes('getUser'));
      assert.match(readFileSync(join(project, 'src', 'app', '(auth)', 'login', 'page.tsx'), 'utf8'), /Sign in/);
      assert.doesNotMatch(readFileSync(join(project, 'src', 'app', '(auth)', 'login', 'page.tsx'), 'utf8'), /Entrar|Senha/);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('inspect returns the generated stack as JSON', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'foundry-test-'));
  try {
    assert.equal(run(['init', 'inspect-app', '--yes', '--json'], workspace).status, 0);
    const result = run(['inspect', '--json'], join(workspace, 'inspect-app'));
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.manifest.file, 'papergio.yaml');
    assert.equal(output.papergio.schema, 'papergio/v1');
    assert.equal(output.foundry.preset, 'saas');
    assert.equal(output.stack.database, 'supabase');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('legacy foundry.yaml projects remain inspectable and verifiable', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'foundry-test-'));
  try {
    assert.equal(run(['init', 'legacy-app', '--yes', '--json'], workspace).status, 0);
    const project = join(workspace, 'legacy-app');
    rmSync(join(project, 'papergio.yaml'));
    const inspect = run(['inspect', '--json'], project);
    const verify = run(['verify', '--json'], project);
    assert.equal(inspect.status, 0);
    assert.equal(verify.status, 0);
    assert.equal(JSON.parse(inspect.stdout).manifest.file, 'foundry.yaml');
    assert.equal(JSON.parse(verify.stdout).checks.papergio_manifest, false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('verify catches a divergent compatibility manifest', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'foundry-test-'));
  try {
    assert.equal(run(['init', 'divergent-app', '--yes', '--json'], workspace).status, 0);
    const project = join(workspace, 'divergent-app');
    writeFileSync(join(project, 'foundry.yaml'), readFileSync(join(project, 'foundry.yaml'), 'utf8').replace('provider: shadcn', 'provider: minimal'));
    const verify = run(['verify', '--json'], project);
    assert.equal(verify.status, 1);
    assert.equal(JSON.parse(verify.stdout).checks.compatibility_manifest_synced, false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('connect records local Git state without external side effects', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'foundry-test-'));
  try {
    assert.equal(run(['init', 'connect-app', '--yes', '--json'], workspace).status, 0);
    const project = join(workspace, 'connect-app');
    const result = run(['connect', 'git', '--json'], project);
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.providers[0].result, 'connected');
    assert.match(readFileSync(join(project, '.foundry', 'connections.json'), 'utf8'), /"git"/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('help is available in English', () => {
  const result = run(['--help'], process.cwd());
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.doesNotMatch(result.stdout, /Escolha|serviços|Criar/);
});

test('invalid input returns an actionable error', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'foundry-test-'));
  try {
    const result = run(['init', 'invalid-ui', '--ui', 'unknown', '--yes'], workspace);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /INVALID_UI/);
    assert.match(result.stderr, /Choose shadcn, tailwind, minimal, or none/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('existing targets are preserved and reported clearly', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'foundry-test-'));
  try {
    const project = join(workspace, 'existing-app');
    mkdirSync(project);
    writeFileSync(join(project, 'keep.txt'), 'user data');
    const result = run(['init', 'existing-app', '--yes'], workspace);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /TARGET_EXISTS/);
    assert.equal(readFileSync(join(project, 'keep.txt'), 'utf8'), 'user data');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('verify and inspect fail safely outside a Foundry project', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'foundry-test-'));
  try {
    const verify = run(['verify', '--json'], workspace);
    const inspect = run(['inspect', '--json'], workspace);
    assert.equal(verify.status, 1);
    assert.equal(inspect.status, 1);
    assert.equal(JSON.parse(verify.stdout).status, 'failed');
    assert.equal(JSON.parse(inspect.stdout).status, 'failed');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('unsupported providers return a concise error', () => {
  const result = run(['connect', 'unknown-provider'], process.cwd());
  assert.equal(result.status, 1);
  assert.match(result.stderr, /UNSUPPORTED_PROVIDER/);
  assert.match(result.stderr, /Choose one of: git, supabase, vercel, github/);
  assert.doesNotMatch(result.stderr, /at connectProject|node:internal/);
});
