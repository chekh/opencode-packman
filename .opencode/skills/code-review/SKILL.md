---
name: code-review
description: Review diffs for opencode-packman with focus on safety, correctness, and MVP behavior.
compatibility: opencode
---

# Code Review (opencode-packman)

Perform a Linus-style critical review of changes in this repo.

## When to use

- Before implementing installers/removers/doctor logic
- Before changing JSON merge rules
- Before wiring CLI commands (apps/cli)
- Before committing anything that touches `.opencode/` layout rules

## What to check (ordered by severity)

1. Safety (filesystem + path handling)
   - Path traversal protections before writes/deletes
   - Symlink handling and normalization
   - “Never delete without lockfile ownership” is preserved

2. Correctness (MVP rules)
   - `add` strategy never overwrites existing owned files
   - Conflicts are detected and surfaced
   - JSON patch deep merge rules are correct (arrays replaced)
   - Remove does not auto-revert JSON patches in MVP

3. Lockfile ownership consistency
   - No duplicate ownership collisions
   - Ownership entries match real installed targets

4. CLI/core separation
   - CLI renders output only; core does filesystem/validation
   - Commands pass correct inputs to core

5. Error messaging
   - Fail with clear, actionable errors
   - No silent overwrites

6. Tests
   - Core changes include/update Vitest coverage

## Output format

Use `REVIEW_TEMPLATE.md` in the current skill directory as the report skeleton.
