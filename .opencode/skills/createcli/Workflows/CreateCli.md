---
workflow: init
purpose: Generate layout for opencode-packman within a target project (project scope).
---

# init workflow (opm init)

## Goal

Prepare a project so `opm install` and `opm doctor` work.

## Steps

1. Determine `projectRoot` (current working directory where user runs `opm`).

2. Create/ensure:
   - `.opencode-packman/lock.yaml`
   - `opencode.json` (if missing, create `{}`)
   - `.opencode/agents`, `.opencode/commands`, `.opencode/skills`

3. Safety rules
   - Never overwrite existing files without an explicit confirmation step.
   - Only create files that are missing.

4. Output
   - Print the list of created files.
