import { buildFiles as buildSaasFiles } from './saas.js';

const templates = {
  saas: {
    name: 'SaaS',
    version: '0.1.0',
    description: 'Next.js + Supabase + Vercel foundation',
    build: buildSaasFiles
  }
};

export function getTemplate(name) {
  const template = templates[name];
  if (!template) throw new Error(`Unsupported preset: ${name}`);
  return template;
}

export function listTemplates() {
  return Object.entries(templates).map(([id, template]) => ({ id, name: template.name, version: template.version, description: template.description }));
}
