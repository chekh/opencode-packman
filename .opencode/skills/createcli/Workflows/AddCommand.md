---
workflow: wiring
purpose: Wire a new `opm` command into apps/cli and delegate logic to packages/core.
---

# wiring workflow (opm command module)

## Steps

1. Add command module
   - Create `apps/cli/src/commands/<command>.ts`
   - Export `run(args, options)`.
   - Keep this module output-only; no filesystem writes.

2. Register in commander
   - Update `apps/cli/src/index.ts`:
     - Add `program.command('<command> ...')`.
     - In `.action(...)` import the module and call its `run`.

3. Implement core logic
   - Put filesystem + validation logic into `packages/core/src/**`.
   - Command module should call core functions and format results.

4. Add tests
   - Write Vitest tests for the core modules.
