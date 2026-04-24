# opencode-packman

`opencode-packman` is a local package installer for OpenCode configuration packs.
It lets you package agents, commands, skills, and `opencode.json` patches, preview the changes, install them into a project, track ownership in a lockfile, and remove installed packages safely.

## What problem it solves

OpenCode resources are often copied manually between projects. `opencode-packman` replaces this with repeatable package install/remove flows and ownership tracking.

## Current MVP scope

Implemented:
- local package loading and validation (`package.yaml`)
- install preview with conflicts
- install (file copy, directory copy, JSON deep merge patch)
- lockfile tracking (`.opencode-packman/lock.yaml`)
- remove by ownership from lockfile
- doctor checks for common project health issues

Out of scope in MVP:
- global scope
- rollback of JSON patches
- dependency resolution
- UI/marketplace integration

See `docs/mvp-limitations.md` for full list.

## Quickstart

Install dependencies:

```bash
pnpm install
```

Build and run tests:

```bash
pnpm build
pnpm test
pnpm lint
```

Run CLI help:

```bash
pnpm --filter @opencode-packman/cli dev -- --help
```

Try full flow in a temp project:

```bash
mkdir -p /tmp/opm-demo
cd /tmp/opm-demo

pnpm --dir /path/to/opencode-packman --filter @opencode-packman/cli dev -- init
pnpm --dir /path/to/opencode-packman --filter @opencode-packman/cli dev -- preview /path/to/opencode-packman/examples/packages/backend-review
pnpm --dir /path/to/opencode-packman --filter @opencode-packman/cli dev -- install /path/to/opencode-packman/examples/packages/backend-review --yes
pnpm --dir /path/to/opencode-packman --filter @opencode-packman/cli dev -- doctor
pnpm --dir /path/to/opencode-packman --filter @opencode-packman/cli dev -- remove backend-review --yes
```

## Package format

Minimal package example:

```text
backend-review/
  package.yaml
  agents/code-reviewer.md
  commands/review.md
  skills/api-review/SKILL.md
  opencode.patch.json
```

See `docs/package-format.md` for full format and validation rules.

## CLI reference

See `docs/cli.md` for command behavior and exit codes.

## Local registry

You can register a local packages root and use short refs like `personal/backend-review`.

Expected registry layout:

```text
<registry-root>/
  packages/
    <package-name>/
      package.yaml
```

Example:

```bash
mkdir -p ~/dev/opencode-packs/packages
cp -R /path/to/opencode-packman/examples/packages/backend-review ~/dev/opencode-packs/packages/backend-review

opm registry add personal ~/dev/opencode-packs
opm registry list
opm registry packages personal
opm preview personal/backend-review
opm install personal/backend-review --yes
opm search review
opm search
```

MVP note:
- only local registries are supported
- no versions/semver resolution in registry refs
- search scans configured local registries only (no remote search)

## Create package scaffold

Scaffold a new minimal package and then customize TODOs:

```bash
opm create package backend-review --type bundle
opm create package api-review --type skill
opm create package backend-review --registry personal
```

Scaffolded files are intentionally minimal placeholders.
Edit descriptions, prompts, and exports before broader usage.

## Smoke check

Run end-to-end smoke script:

```bash
pnpm smoke
```
