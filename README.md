# Papergio CLI

Papergio CLI generates coherent project foundations for AI-assisted development. Foundry is the internal classifier for the foundation engine and remains available as a compatibility command.

The CLI orchestration lives in `src/cli.js`; prompts, inspection, and the SaaS template are kept in separate modules under `src/`.

## Prototype

```bash
node src/cli.js init my-app
```

The terminal lets you choose the preset and UI layer with the arrow keys. The `saas` preset generates a neutral Next.js project with Supabase Auth/Postgres foundations, minimal auth/dashboard/admin routes, Vercel, Git, GitHub Actions, `AGENTS.md`, and a canonical `papergio.yaml` manifest. `foundry.yaml` is also generated as a temporary compatibility copy for older Foundry tooling.

For agents and CI, use deterministic flags:

```bash
node src/cli.js init my-app --preset saas --ui minimal --yes --json
cd my-app
node ../src/cli.js verify --json
```

Inspect a generated project:

```bash
node src/cli.js inspect
node src/cli.js inspect --json
```

Connect local projects to provider CLIs:

```bash
node src/cli.js connect
node src/cli.js connect supabase --link --json
node src/cli.js connect vercel --link --json
node src/cli.js connect github --create-repo --repo my-account/my-app --push
```

`connect` checks installed CLIs and authentication, asks for confirmation before external actions, and stores non-secret local state in `.foundry/connections.json`. Provider credentials should come from the provider CLI or environment variables such as `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, and `GH_TOKEN`.

Run the CLI test suite:

```bash
npm test
```

The generated SaaS project includes server-side Supabase session checks, route protection through `src/proxy.ts`, basic `user`/`admin` authorization, and an initial profile migration.

`verify` reports structural checks, environment warnings, provider links, Git remotes, and runs the real build when `node_modules` is available. Missing `.env.local`, provider CLIs, or remotes are reported as warnings instead of being silently ignored.

The CLI does not create remote Supabase, Vercel, or GitHub resources yet. It prepares the local project for those integrations.
