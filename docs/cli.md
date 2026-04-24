# CLI Reference (MVP)

All commands run in project scope.

## `opm create package <name>`

Creates a minimal package scaffold with TODO placeholders.

Options:
- `--type <type>`: `bundle | skill | agent | command | profile` (default: `bundle`)
- `--dir <path>`: parent directory for created package
- `--registry <name>`: create at `<registry.path>/packages/<name>`
- `--force`: allow existing non-empty target directory

Rules:
- cannot combine `--dir` and `--registry`
- package name must use lowercase letters, numbers, dash, underscore

Examples:

```bash
opm create package backend-review --type bundle
opm create package api-review --type skill
opm create package backend-review --registry personal
```

Output style:

```text
Package scaffold created

Name: backend-review
Type: bundle
Path: /abs/path/backend-review

Created:
  package.yaml
  agents/backend-review-reviewer.md
  commands/backend-review-review.md
  skills/backend-review-skill/SKILL.md
  opencode.patch.json

Next:
  opm preview /abs/path/backend-review
  opm install /abs/path/backend-review --yes
```

## `opm init`

Creates missing project layout:
- `opencode.json` (as `{}`)
- `.opencode/agents`
- `.opencode/commands`
- `.opencode/skills`
- `.opencode-packman/lock.yaml`

Does not overwrite existing files.

Output style:

```text
Init result

Status: initialized

Created:
  .opencode
  .opencode/agents
  ...

Already existed:
  none
```

## `opm preview <packageRef>`

Builds install plan and prints:
- actions (add/replace/patch)
- conflicts
- validation result

`packageRef` can be:
- direct path to package folder
- `<registry>/<package>` from local registry config

Makes no filesystem changes.
Exit code:
- `0` when plan has no validation errors/conflicts
- `1` otherwise

Output style starts with:

```text
Install preview

Package: <name>@<version>
Scope: project
...
```

## `opm install <packageRef> [--yes] [--dry-run]`

Flow:
1. build install plan
2. print preview
3. stop on validation errors/conflicts
4. optional confirm (unless `--yes`)
5. apply actions
6. update lockfile

Options:
- `--yes`: skip confirmation
- `--dry-run`: preview only

`packageRef` can be:
- direct path to package folder
- `<registry>/<package>` from local registry config

Success output includes:

```text
Install result

Package: <name>@<version>
Status: installed

Files written: <n>
Patches applied: <n>
Lockfile: .opencode-packman/lock.yaml

Warnings:
  none
```

## `opm remove <packageName> [--yes] [--dry-run]`

Flow:
1. build remove plan from lock ownership
2. print remove plan
3. optional confirm (unless `--yes`)
4. delete owned targets
5. update lockfile

Important:
- JSON patches are **not** rolled back automatically in MVP.
- CLI prints manual notice to review `opencode.json`.

Options:
- `--yes`: skip confirmation
- `--dry-run`: plan only

Output style starts with:

```text
Remove preview

Package: <name>
...
```

## `opm doctor`

Runs health checks for:
- `opencode.json` exists and is valid JSON object
- `.opencode` exists
- lockfile exists and is valid
- locked targets exist and are safe
- locked skills contain `SKILL.md`
- package ownership consistency

Report status:
- `healthy`
- `warning`
- `broken`

Exit code:
- `0` for `healthy` and `warning`
- `1` for `broken`

Output style starts with:

```text
Doctor report

Status: healthy|warning|broken
...
```

## `opm registry`

Local registries are stored in `~/.opencode-packman/registries.yaml`.

Supported commands:
- `opm registry add <name> <path> [--force]`
- `opm registry list`
- `opm registry remove <name>`
- `opm registry packages <name>`

Expected local registry layout:

```text
<registry-root>/
  packages/
    backend-review/
      package.yaml
```

Example:

```bash
opm registry add personal ~/dev/opencode-packs
opm registry list
opm preview personal/backend-review
opm install personal/backend-review --yes
```

Add output style:

```text
Registry added

Name: personal
Type: local
Path: /Users/me/dev/opencode-packs

Next:
  opm registry list
  opm install personal/backend-review --yes
```

List packages in a registry:

```bash
opm registry packages personal
```

Output style:

```text
Registry packages

Registry: personal

backend-review
  Version: 0.1.0
  Type: bundle
  Description: Basic backend review setup for OpenCode
  Install: opm install personal/backend-review --yes
```

If registry exists but has no valid packages:

```text
Registry packages

Registry: personal

none
```

## `opm search [query]`

Searches packages across configured local registries only.

Examples:

```bash
opm search review
opm search bundle
opm search
```

Notes:
- no remote registry search in MVP
- no versions/semver filters in MVP
- search only scans configured local registries

Output style:

```text
Package search

Query: review

personal/backend-review
  Version: 0.1.0
  Type: bundle
  Description: Basic backend review setup for OpenCode
  Install: opm install personal/backend-review --yes
```
