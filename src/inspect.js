import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readManifest, yamlValue } from './manifest.js';

export function inspectProject(target, json = false) {
  const manifestFile = readManifest(target);
  const packagePath = join(target, 'package.json');
  if (!manifestFile || !existsSync(packagePath)) {
    const result = { status: 'failed', reason: 'Not a Foundry project', target };
    if (json) console.log(JSON.stringify(result, null, 2)); else console.error(`Not a Foundry project: ${target}`);
    return false;
  }
  const manifest = manifestFile.source;
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const result = {
    status: 'ok',
    target,
    manifest: { file: manifestFile.file, format: manifestFile.format },
    papergio: { schema: yamlValue(manifest, 'schema'), project: yamlValue(manifest, 'name') },
    foundry: { version: yamlValue(manifest, 'version'), preset: yamlValue(manifest, 'preset'), preset_version: yamlValue(manifest, 'preset_version') },
    stack: { frontend: yamlValue(manifest, 'frontend'), backend: yamlValue(manifest, 'backend'), database: yamlValue(manifest, 'database'), deploy: yamlValue(manifest, 'deploy'), source_control: yamlValue(manifest, 'source_control') ?? yamlValue(manifest, 'repository') },
    ui: { provider: yamlValue(manifest, 'provider'), tailwind: yamlValue(manifest, 'tailwind') === 'true' },
    modules: { auth: yamlValue(manifest, 'auth') === 'true', admin: yamlValue(manifest, 'admin') === 'true', billing: yamlValue(manifest, 'billing') === 'true' },
    package: { name: packageJson.name, dependencies: Object.keys(packageJson.dependencies ?? {}) }
  };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Foundry project: ${result.package.name}`);
    console.log(`Preset: ${result.foundry.preset}@${result.foundry.preset_version}`);
    console.log(`Stack: ${Object.values(result.stack).filter(Boolean).join(' · ')}`);
    console.log(`UI: ${result.ui.provider}${result.ui.tailwind ? ' (Tailwind)' : ''}`);
    console.log(`Modules: ${Object.entries(result.modules).filter(([, enabled]) => enabled).map(([name]) => name).join(', ') || 'none'}`);
  }
  return true;
}
