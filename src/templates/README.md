# Templates

Each preset is registered in `index.js` and exposes a `build(project, ui, version)` function that returns the files to generate. Every generated project must include `papergio.yaml` as its canonical ecosystem manifest. Keep `foundry.yaml` only when backward compatibility with older Foundry versions is required.

Current presets:

- `saas`: Next.js, Supabase, Vercel and Git foundation.

Future presets can be added without changing the generation flow in `src/cli.js`.
