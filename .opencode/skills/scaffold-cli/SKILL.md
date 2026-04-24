---
name: scaffold-cli
description: Scaffold and wire new `opm` CLI command modules in apps/cli for opencode-packman.
compatibility: opencode
---

# Scaffold CLI (opencode-packman)

Use this skill when you need to add a new `opm <command>` implementation or restructure `apps/cli` so that CLI stays thin and all business logic lives in `packages/core`.

## Target structure (repo-specific)

1. Create/modify CLI wiring:
   - `apps/cli/src/index.ts`
   - `apps/cli/src/commands/<command>.ts`

2. Put logic in core:
   - `packages/core/src/**`

## Steps

1. Pick the command boundary
   - CLI responsibilities: parse args, call core, render output.
   - Core responsibilities: filesystem changes, validation, install plan building, lockfile updates, doctor checks.

2. Create a command module
   - File: `apps/cli/src/commands/<command>.ts`
   - Export a single `run(args, options)` (or similar) function.
   - Keep side effects limited to printing; all reads/writes happen in core.

3. Wire commander
   - In `apps/cli/src/index.ts` add `program.command('<command>')`.
   - Map commander options to the command module inputs.

4. Connect to core
   - Implement/extend the needed functions under `packages/core/src/**`.
   - Example starting points:
     - `packages/core/src/package/packageLoader.ts`
     - `packages/core/src/package/packageValidator.ts`
     - `packages/core/src/plan/planBuilder.ts`
     - `packages/core/src/install/installer.ts`
     - `packages/core/src/doctor/doctor.ts`

5. Add tests (core-first)
   - Put unit tests next to the core modules where possible.
   - Minimal coverage should include: package loading/validation, conflict detection, JSON deep merge for patches, lockfile write, and doctor checks.

## Output checklist

- `apps/cli/src/index.ts` registers the command.
- The command module calls core.
- Core functions are test-covered.
