# opencode-packman

`opencode-packman` is a local package installer for OpenCode configuration packs.
It packages agents, commands, skills, and config patches, then installs them into a project with ownership tracking.

## MVP goal

The MVP focuses on local packages, previewing changes, installing into a project, tracking files in a lockfile, removing owned files, and running doctor checks.

## Install dependencies

```bash
pnpm install
```

## Run the CLI locally

```bash
pnpm --filter @opencode-packman/cli dev -- --help
```

## Planned commands

- `opm init`
- `opm preview <packagePath>`
- `opm install <packagePath>`
- `opm remove <packageName>`
- `opm doctor`

## Example package

The example package lives in `examples/packages/backend-review`.
