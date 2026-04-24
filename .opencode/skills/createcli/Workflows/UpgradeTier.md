---
workflow: install-options
purpose: Add/extend commander options and map them to core inputs for install/remove.
---

# options workflow (install/remove MVP flags)

## MVP flags to support

- `opm install <packagePath>`
  - `--scope project|global`
  - `--yes`
  - `--dry-run`

- `opm remove <packageName>`
  - no JSON-patch rollback automatically (must warn)

## Steps

1. Update commander definitions in `apps/cli/src/index.ts`.

2. Validate CLI inputs
   - Scope must be `project` or `global`.
   - `--yes` controls whether to apply destructive actions.

3. Delegate to core
   - Preview: core builds install plan + renders diff.
   - Install: core applies install plan, updates lockfile.
   - Remove: core deletes owned files and updates lockfile.

4. Output safety warnings
   - If remove touches JSON patches: print
     `JSON patches are not automatically reverted in MVP. Please review opencode.json manually.`
