import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MANIFESTS = [
  { file: 'papergio.yaml', format: 'papergio/v1' },
  { file: 'foundry.yaml', format: 'foundry/legacy' }
];

export function findManifest(target) {
  for (const manifest of MANIFESTS) {
    const path = join(target, manifest.file);
    if (existsSync(path)) return { ...manifest, path };
  }
  return null;
}

export function readManifest(target) {
  const manifest = findManifest(target);
  return manifest ? { ...manifest, source: readFileSync(manifest.path, 'utf8') } : null;
}

export function yamlValue(source, key) {
  const line = source.split(/\r?\n/).find((item) => item.trim().startsWith(`${key}:`));
  return line ? line.split(':').slice(1).join(':').trim() : null;
}
