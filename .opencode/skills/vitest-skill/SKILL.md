---
name: vitest-skill
description: Write Vitest tests for opencode-packman core (package loading/validation, install plan/conflicts, JSON patch merge, lockfile, doctor).
compatibility: opencode
---

# Vitest Skill (opencode-packman)

Use this skill when you are adding or fixing unit tests for `packages/core`.

## What to test (minimum MVP set)

1. Package loading
   - Loads valid package from a folder
   - Rejects missing `package.yaml`
   - Rejects missing export path

2. Install plan building
   - Builds plan actions for file copy + JSON patch
   - Detects conflict when strategy is `add` but target exists

3. JSON patch merge (MVP rules)
   - Deep merge of objects
   - Arrays replaced (not merged)
   - Primitives overwrite

4. Lockfile
   - Writes `.opencode-packman/lock.yaml` after install
   - Records ownership per installed file and config patch

5. Doctor
   - Reports WARN/ERROR when a locked skill directory misses `SKILL.md`

## Test style rules

- Use temporary directories for filesystem tests.
- Make filesystem access deterministic.
- Assert on:
  - produced plan structure
  - existence of created files
  - contents of `opencode.json` after patch merge
  - lockfile ownership structure
  - doctor report output

## Vitest patterns you will use

- `describe/it/expect` for unit tests
- `vi.mock` for mocking pure helpers when needed
- `beforeEach/afterEach` to cleanup temp dirs

## Example skeleton (opencode-packman)

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { loadPackage } from '../../../packages/core/src/package/packageLoader'

describe('package loader', () => {
  it('rejects when package.yaml is missing', async () => {
    // arrange temp dir with no package.yaml
    // act: loadPackage
    // assert: throws / returns invalid
  })
})
```

## Where to put tests

- If the code is pure: keep tests next to the module under `packages/core/src/**`.
- If it touches filesystem: still keep tests under `packages/core/src/**`, but use temp folders.
