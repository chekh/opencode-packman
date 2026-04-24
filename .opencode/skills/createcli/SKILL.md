---
name: createcli
description: Implement `opm` CLI commands for opencode-packman in apps/cli, calling core logic from packages/core.
compatibility: opencode
---

# Create CLI (opencode-packman)

Use this skill when implementing or extending `opm` commands:

- `opm init`
- `opm preview <packagePath>`
- `opm install <packagePath>`
- `opm remove <packageName>`
- `opm doctor`

## Repo wiring (must follow)

1. CLI wiring: `apps/cli/src/index.ts`
2. Command modules: `apps/cli/src/commands/<command>.ts` (create the folder if missing)
3. Core logic: `packages/core/src/**`

## Command-specific checklist

### `init`

Core-first requirements:
- Create `.opencode-packman/lock.yaml` (project scope)
- Ensure `opencode.json` exists (if missing, create `{}`)
- Ensure `.opencode/agents`, `.opencode/commands`, `.opencode/skills` directories exist
- Never overwrite existing user files without explicit confirmation

CLI responsibilities:
- Parse flags for project scope behavior (if you add it)
- Print which files were created

### `preview <packagePath>`

Core responsibilities:
- Load `package.yaml` from `<packagePath>`
- Validate schema and exports
- Build install plan (including conflicts/warnings)
- Render human-readable preview output

CLI responsibilities:
- Pass `<packagePath>` through to core
- Print preview; do not write to disk

### `install <packagePath>`

Flags (MVP): `--scope project|global`, `--yes`, `--dry-run`

Core responsibilities:
- Build install plan
- Apply file actions + JSON patch merge into `opencode.json`
- Update lockfile ownership records

CLI responsibilities:
- If not `--yes`, prompt before applying changes
- If `--dry-run`, only print preview
- On completion, print a short summary (what changed + where)

### `remove <packageName>`

Core responsibilities:
- Read package ownership from lockfile
- Remove only files owned by that package
- Update lockfile accordingly
- Do NOT automatically revert JSON patches in MVP; warn user explicitly

CLI responsibilities:
- Always show what will be removed before deleting

### `doctor`

Core responsibilities:
- Validate presence of `opencode.json`
- Validate `.opencode` directories and lockfile
- Validate that all locked files exist
- Validate `SKILL.md` presence in each installed skill directory

CLI responsibilities:
- Print a clear OK/WARN/ERROR report

## Implementation notes (real constraints from MVP)

- Enforce path traversal safety when writing/removing.
- For config patching: only accept JSON object patches; implement deep merge where arrays are replaced.
- Keep filesystem side effects inside core.

## Wiring template (Commander)

Update `apps/cli/src/index.ts` to create commands and delegate:

1. Add command definition:
   - `.command('install <packagePath>')`
2. Use `.action((packagePath, cmdOptions) => runInstall({ packagePath, ...cmdOptions }))`
3. Export command module `run*` functions and import them into `index.ts`.
