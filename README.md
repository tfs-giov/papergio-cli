# Papergio CLI

Create a strong starting point for your next product — with the boring, important pieces already connected.

Papergio CLI generates production-minded project foundations for humans and coding agents. It gives a new project structure, conventions, auth boundaries, database wiring, verification, and agent context before feature work begins.

[![npm version](https://img.shields.io/npm/v/@papergio/cli?color=ff4d3d&label=npm)](https://www.npmjs.com/package/@papergio/cli)
[![CI](https://github.com/tfs-giov/papergio-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/tfs-giov/papergio-cli/actions)
[![License](https://img.shields.io/badge/license-MIT-111111.svg)](LICENSE)

> Foundry is Papergio's internal classifier for foundation types. The public project manifest is `papergio.yaml`.

## Start here

```bash
npm install -g @papergio/cli
papergio init my-saas --preset saas --ui shadcn --yes --json
cd my-saas
papergio inspect --json
papergio verify --json
```

Prefer not to install globally?

```bash
npx @papergio/cli init my-saas --preset saas --ui shadcn --yes --json
```

The interactive version is also available:

```bash
papergio init my-app
```

## What it creates

The `saas` foundation starts with a neutral, adaptable base for product work:

- Next.js application structure with a clear route boundary
- Supabase Auth, Postgres, migrations, and profile foundation
- Protected user and admin areas with server-side checks
- Vercel, Git, and GitHub Actions project wiring
- `AGENTS.md` for durable context across coding agents
- `papergio.yaml` describing the selected foundation and providers
- `foundry.yaml` as a compatibility copy for older internal tooling
- verification commands that expose missing setup instead of hiding it

Papergio creates the local foundation. Your product decisions, visual identity, domain logic, and provider credentials remain yours.

## Commands

| Command | What it does |
| --- | --- |
| `papergio init <name>` | Generate a project from a versioned foundation |
| `papergio inspect` | Summarize the generated manifest and stack |
| `papergio doctor` | Check local tools and integration readiness |
| `papergio verify` | Run foundation, provider, Git, and build checks |
| `papergio connect` | Inspect or explicitly link provider tooling |

Use `--json` for machine-readable output in CI and agent workflows.

```bash
papergio doctor --json
papergio connect supabase --link --json
papergio connect vercel --link --json
papergio connect github --create-repo --repo my-account/my-app --push
```

Provider actions stay explicit. `connect` checks installed CLIs and authentication, asks before external actions, and stores only non-secret local state in `.foundry/connections.json`. Credentials should come from provider CLIs or environment variables such as `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, and `GH_TOKEN`.

## Foundation presets

The first public release includes the `saas` preset and four UI layers:

```bash
papergio init my-saas --preset saas --ui shadcn --yes
```

Available UI layers are `shadcn`, `tailwind`, `minimal`, and `none`. They keep the generated product neutral enough for an agent or team to shape later.

## Development

```bash
git clone https://github.com/tfs-giov/papergio-cli.git
cd papergio-cli
npm install
npm test
```

Papergio CLI requires Node.js 18 or newer.

## Current scope

This is an early public release. The CLI prepares local projects and integration boundaries; it does not silently create remote Supabase, Vercel, or GitHub resources. Use `papergio connect` when you are ready to link or create them explicitly.

Read the [Papergio Docs](https://docs.papergio.com.br/), browse the [Papergio Tools](https://tools.papergio.com.br/), or open an [issue](https://github.com/tfs-giov/papergio-cli/issues) with feedback.
