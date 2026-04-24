---
name: documentation
description: Keep README and docs for opencode-packman in sync with code changes (package format, lockfile, CLI usage).
compatibility: opencode
---

# Documentation (opencode-packman)

Create or update repository docs so the project can be used and extended without tribal knowledge.

## Where to write

- `README.md`
- `docs/init.md`
- `docs/package-format.md`
- `docs/lockfile.md`
- `docs/cli.md`
- `docs/roadmap.md`

## What to update (trigger list)

Update docs when you change any of the following:
- `package.yaml` schema validation rules
- install plan action types and merge/patch semantics
- JSON patch merge behavior (arrays replace, objects deep merge)
- lockfile format or ownership model
- `opm` CLI command behavior and flags
- remove behavior (especially warning about JSON patches not being reverted automatically)
- doctor checks

## Documentation rules for this repo

- Prefer concrete examples from `examples/packages/backend-review/`
- Document what is created/changed in project scope:
  - `opencode.json`
  - `.opencode/agents|commands|skills`
  - `.opencode-packman/lock.yaml`
- Keep CLI examples aligned with your actual commander implementation

## Output requirement

When you finish an implementation that affects user-visible behavior, provide a short “Docs updates” checklist:
- which file(s) were changed
- what new behavior the docs now describe
