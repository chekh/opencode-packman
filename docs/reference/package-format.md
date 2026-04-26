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

All sections are optional in exports, but at least one export must be present.

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
- `version`: any string (checked for non-empty in MVP)
- `description`: optional, but recommended

## Supported strategies

| Export type | `add` | `replace` | `patch` |
| ----------- | ----- | --------- | ------- |
| agents      | ✓     | ✓         | —       |
| commands    | ✓     | ✓         | —       |
| skills      | ✓     | ✓         | —       |
| config      | —     | —         | ✓       |

Strategy meanings:

- **add**: add if target does not exist, fail if exists
- **replace**: replace existing target, create if doesn't exist
- **patch**: deep merge JSON object into target config

## Path mapping

Package export path → Project target path:

| Export type | Package path         | Project target path          |
| ----------- | -------------------- | ---------------------------- |
| agents      | `agents/name.md`     | `.opencode/agents/name.md`   |
| commands    | `commands/name.md`   | `.opencode/commands/name.md` |
| skills      | `skills/name/`       | `.opencode/skills/name/`     |
| config      | `path/to/patch.json` | `opencode.json` (merged)     |

## SKILL.md requirements

Every exported skill directory must contain `SKILL.md` with YAML frontmatter including both:

- `name` (non-empty string)
- `description` (non-empty string)

Example valid `SKILL.md`:

```md
---
name: api-review
description: Review REST and GraphQL API design for consistency and correctness.
---

Use this skill when reviewing APIs.
```

Invalid examples (validation will fail):

```md
---
# missing name and description
---

Content here.
```

```md
---
name: api-review
# missing description
---

Content here.
```

## Config patch requirements

- Patch file must be valid JSON object (not array, not primitive)
- Merge behavior in MVP:
  - object + object → recursive deep merge
  - arrays → replace (not merged)
  - primitive values → overwrite

Example patch (`opencode.patch.json`):

```json
{
  "permission": {
    "bash": {
      "rm *": "deny",
      "git *": "ask"
    }
  },
  "agents": ["reviewer"]
}
```

If target `opencode.json` is:

```json
{
  "permission": {
    "bash": {
      "git *": "allow"
    }
  }
}
```

After patch applied (result):

```json
{
  "permission": {
    "bash": {
      "rm *": "deny",
      "git *": "ask"
    }
  },
  "agents": ["reviewer"]
}
```

Note: `permission.bash.git *` was overwritten, not merged. Array was replaced.

## Package types

| Type    | Intended for                        |
| ------- | ----------------------------------- |
| skill   | Single skill                        |
| agent   | Single agent                        |
| command | Single command                      |
| bundle  | Multiple resources + optional patch |
| profile | Full configuration preset           |

Type is metadata. All types use same export mechanism.

## Validation failures

| Error                            | Cause                                          |
| -------------------------------- | ---------------------------------------------- |
| missing package.yaml             | File not found in package root                 |
| invalid schema                   | Schema value not `opencode-packman/package/v1` |
| invalid type                     | Type not in supported list                     |
| missing export path              | Referenced file/directory doesn't exist        |
| invalid strategy for export type | e.g., `patch` used with agents/commands/skills |
| skill without SKILL.md           | Skill directory exists but no SKILL.md inside  |
| invalid SKILL.md frontmatter     | Missing `name` or `description`                |
| patch is not JSON object         | Config patch file is array or primitive        |

## Scaffold note

`opm create package <name>` generates minimal package templates with TODO placeholders.

Output includes:

```text
package.yaml (with TODO fields)
agents/<name>-reviewer.md
commands/<name>-review.md
skills/<name>-skill/SKILL.md
opencode.patch.json
```

Scaffolded files are valid for MVP flow but contain placeholder content. Update descriptions, prompts, and configurations before relying on them.

## Package naming rules

- Must be lowercase
- Can contain: letters, numbers, dash (`-`), underscore (`_`)
- Must start with letter
- Recommended max 50 characters

## Model alias behavior

When an export specifies `model: alias:<name>`:

```yaml
exports:
  agents:
    - name: reviewer
      path: agents/reviewer.md
      strategy: add
      model: alias:review-model
```

The alias is **recorded in lockfile metadata**, not compiled into the installed file content.

### What happens on install:

1. Alias name is extracted from `model: alias:<name>`
2. Alias is resolved to actual model identifier (if defined)
3. Both `modelAlias` and `resolvedModel` are recorded in lockfile entry
4. **Agent/command file is copied unchanged** — no content transformation

### Why this design:

- OpenCode reads model from its own config, not from agent/command files
- Lockfile tracks what alias was used for audit purposes
- Doctor checks that referenced aliases are defined

### To check alias resolution:

```bash
opm doctor
```

If an installed package uses an undefined alias, doctor reports `unknown_model_alias`.
