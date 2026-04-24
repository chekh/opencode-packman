---
name: typescript
description: TypeScript guidance for opencode-packman (strict typing, monorepo + Node ESM, Zod schemas, filesystem-safe code).
compatibility: opencode
author: mguinada
version: 1.0.0
tags: [typescript, types, type-safety, generics, strict, monorepo]
---

# TypeScript (opencode-packman)

Use this skill when editing `packages/core` or `apps/cli`.

## Repo-specific constraints

- Node ESM: repository uses `"type": "module"`.
- Keep CLI thin: `apps/cli` should only parse args and print; all logic lives in `packages/core`.
- Validate inputs with Zod (or equivalent) before writing files.
- Prefer narrow types over `any`.
- Model JSON patch merge rules explicitly in types and helpers.

## Quick Start checklist

1. Check relevant TS config
   - `tsconfig.base.json`
   - `packages/core/tsconfig.json`
   - `apps/cli/tsconfig.json`

2. Ensure exports/imports are correct for ESM
   - Use relative imports for internal modules.

3. Add/extend types next to the code
   - For example, install plan and lockfile types should live with the modules that build/consume them.

## Common fixes (when code doesn’t typecheck)

- Use `unknown` at boundaries (filesystem/JSON), then refine.
- If you need to represent “optional field present when strategy is patch”, prefer discriminated unions.
- If types blow up (deep unions), break helpers into smaller functions and keep return types explicit.

## Where to apply guidance

- `packages/core/src/package/*` (loading/validation)
- `packages/core/src/plan/*` (install plan types + conflicts)
- `packages/core/src/install/*` (file actions + JSON patch merge)
- `packages/core/src/lock/*` (lockfile schema + ownership)
- `packages/core/src/doctor/*` (doctor checks)
