# Lockfile Format

Lockfile tracks installed packages, their versions, and ownership of installed files.

## Location

```
.opencode-packman/lock.yaml
```

Created in project root after first install.

## Schema

```yaml
schema: opencode-packman/lock/v1

packages:
  backend-review:
    version: 0.1.0
    source: ../packages/backend-review
    installedAt: 2026-04-24T12:00:00.000Z
    scope: project

files:
  .opencode/agents/code-reviewer.md:
    owner: backend-review
    version: 0.1.0
    strategy: replace

  .opencode/commands/review.md:
    owner: backend-review
    version: 0.1.0
    strategy: add

  .opencode/skills/api-review:
    owner: backend-review
    version: 0.1.0
    strategy: replace

patches:
  opencode.json:
    - owner: backend-review
      version: 0.1.0
      patchFile: opencode.patch.json
```

## Sections

### `packages`

Metadata about installed packages:
- `version`: package version string
- `source`: original package location (path or registry ref)
- `installedAt`: ISO timestamp
- `scope`: currently only `project`

### `files`

Tracks every file installed by a package:
- `owner`: package name
- `version`: package version at install time
- `strategy`: `add` or `replace`

Used by:
- conflict detection (another package trying to own same target)
- remove (delete only owned files)

### `patches`

Tracks JSON config patches:
- `owner`: package name
- `version`: package version
- `patchFile`: patch file path relative to package root

Note: patches are not automatically reverted on remove in MVP.

## Ownership rules

- Each file has exactly one owner in lockfile
- Remove deletes files owned by the specified package
- Conflicts detected when:
  - target file exists and strategy is `add`
  - target already owned by another package

## Lockfile operations

### Read

`opm doctor` reads lockfile to verify installed files exist and ownership is consistent.

### Update

- `opm install` adds package entry and all installed files
- `opm remove` removes package entry and owned files from lockfile

### Manual editing

Not recommended. If lockfile is incorrectly edited:
- `opm doctor` will report ownership inconsistencies
- `opm remove` may fail or delete wrong files

## Migration note

Future versions may support lockfile schema upgrades. Always keep lockfile in project.