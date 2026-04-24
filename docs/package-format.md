# Package Format (MVP)

`opencode-packman` installs local folders that contain `package.yaml`.

## Minimal structure

```text
my-package/
  package.yaml
  agents/
  commands/
  skills/
  opencode.patch.json
```

## `package.yaml`

```yaml
schema: opencode-packman/package/v1
name: backend-review
version: 0.1.0
type: bundle
description: Basic backend review setup for OpenCode

exports:
  agents:
    - name: code-reviewer
      path: agents/code-reviewer.md
      strategy: replace

  commands:
    - name: review
      path: commands/review.md
      strategy: add

  skills:
    - name: api-review
      path: skills/api-review
      strategy: replace

  config:
    - path: opencode.patch.json
      strategy: patch
```

## Supported values

- `schema`: `opencode-packman/package/v1`
- `type`: `skill | agent | command | bundle | profile`
- strategies:
  - `agents/commands/skills`: `add | replace`
  - `config`: `patch`

## Path mapping

- `agents/<name>.md` -> `.opencode/agents/<name>.md`
- `commands/<name>.md` -> `.opencode/commands/<name>.md`
- `skills/<name>/` -> `.opencode/skills/<name>/`
- `config` patch -> `opencode.json`

## SKILL.md requirements

Every exported skill directory must contain `SKILL.md` with YAML frontmatter including non-empty:
- `name`
- `description`

Example:

```md
---
name: api-review
description: Review API design quality and consistency.
---
```

## Config patch requirements

- patch file must be valid JSON object (not array)
- merge behavior in MVP:
  - object + object -> recursive merge
  - arrays -> replace
  - primitive values -> overwrite

## Validation failures (examples)

- missing `package.yaml`
- missing export path
- invalid strategy for export type
- skill without `SKILL.md`
- invalid/missing frontmatter in `SKILL.md`
- `opencode.patch.json` is not a JSON object

## Scaffold note

`opm create package <name>` generates minimal package templates with TODO fields.
Generated files are valid for MVP flow, but you should update descriptions and content before relying on them.
