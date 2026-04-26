# Registry Format

Registries define named collections of packages that can be installed by reference.

## Location

Registry configuration is stored in:

```
~/.config/opencode-packman/registries.yaml
```

This is a global configuration file shared across all projects.

## Purpose

Registries enable:

1. **Short package references** — `opm install personal/backend-review` instead of full path
2. **Multiple package sources** — separate personal, work, and vendor package collections
3. **Team sharing** — commit registry config to dotfiles for team consistency

## Schema

```yaml
schema: opencode-packman/registries/v1
registries:
  personal:
    type: local
    path: ~/packages/opencode

  work:
    type: local
    path: /opt/opencode-packages

  vendor:
    type: local
    path: ./vendor-packages
```

## Sections

### `schema`

Must be exactly `opencode-packman/registries/v1`.

### `registries`

Map of registry names to registry entries:

- `type`: Registry type (only `local` supported in v1.0.0)
- `path`: Path to directory containing packages

## Registry structure

Each registry is a directory containing package subdirectories:

```
my-registry/
  backend-review/
    package.yaml
    agents/
    commands/
    skills/

  frontend-tools/
    package.yaml
    ...
```

## Package resolution

When you run:

```bash
opm install personal/backend-review
```

The resolver:

1. Reads `~/.config/opencode-packman/registries.yaml`
2. Finds registry named `personal`
3. Looks for `backend-review/` subdirectory in registry path
4. Resolves full path and proceeds with installation

## CLI commands

### Add registry

```bash
opm registry add personal ~/packages/opencode
```

Creates or updates registry entry in config.

### Remove registry

```bash
opm registry remove personal
```

Removes registry entry from config (does not delete packages).

### List registries

```bash
opm registry list
```

Shows all configured registries with their paths.

## Path formats

Registry paths support:

- Absolute paths: `/opt/packages`
- Home directory: `~/packages` (expanded to `/home/user/packages`)
- Relative paths: `./vendor-packages` (relative to current working directory)

## Scope

Registry configuration is **global only** — there is no project-level registry config.

This is intentional: registries are about discovering packages, not about project-specific installation.

## Schema version

Current schema: `opencode-packman/registries/v1`

The schema field is required and must match exactly. Future versions may introduce:

- Remote registry type (HTTP/HTTPS)
- Git-based registries
- Authentication for private registries
