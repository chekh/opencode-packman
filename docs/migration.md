# Migration Notes

This document tracks important changes between versions and migration guidance.

## v1.0.0

### JSON Schemas

v1.0.0 introduces stable JSON schemas for all configuration files:

| Schema                           | Location               | Purpose                     |
| -------------------------------- | ---------------------- | --------------------------- |
| `opencode-packman/package/v1`    | `package.schema.json`  | Package manifest validation |
| `opencode-packman/lock/v1`       | `lock.schema.json`     | Lockfile validation         |
| `opencode-packman/baseline/v1`   | `baseline.schema.json` | Baseline validation         |
| `opencode-packman/registries/v1` | `registry.schema.json` | Registry config validation  |

These schemas are available in `@opencode-packman/schemas` package and can be used by external tools for validation.

### Scope Support

v0.8.0 introduced global scope support. All relevant commands now accept `--global` flag:

- `opm init --global` — initialize global OpenCode config
- `opm preview <ref> --global` — preview installation to global scope
- `opm install <ref> --global` — install to global scope
- `opm remove <name> --global` — remove from global scope
- `opm doctor --global` — check global scope health

Lockfile entries now include `scope` field to distinguish project vs global installations.

### Sandbox Testing

v0.9.0 introduced package sandbox testing:

```bash
opm package test <packageRef>
```

This runs a full install/remove cycle in an isolated temporary directory to verify package behavior before production use.

### Checksums

v1.0.0 lockfile entries include optional `checksum` field for installed files. This enables:

- Integrity verification via `opm doctor`
- Detection of manual modifications to installed files

Existing lockfiles without checksums remain valid. Checksums are added on fresh installs.

## Upgrading to v1.0.0

### From v0.x

No breaking changes in file formats. To upgrade:

1. Update `opencode-packman` to v1.0.0
2. Run `opm doctor` to verify project state
3. Optionally, reinstall packages to add checksums to lockfile

### Recommended practices for v1.0.0

1. **Commit lockfile and baseline** — These files should be in version control
2. **Do not commit opencode.json changes from patches** — Review patch effects manually
3. **Use registry references** — `opm install personal/backend-review` is more portable than path references
4. **Run package test before production install** — Verify package behavior in sandbox

## Version History

| Version | Release | Key Features                                |
| ------- | ------- | ------------------------------------------- |
| v1.0.0  | 2026-04 | Stable formats, JSON schemas, checksums     |
| v0.9.0  | 2026-04 | Package sandbox testing                     |
| v0.8.0  | 2026-04 | Global scope support                        |
| v0.7.0  | 2026-04 | Registry workflow                           |
| v0.6.0  | 2026-04 | Model aliases                               |
| v0.5.0  | 2026-04 | Package publisher                           |
| v0.4.0  | 2026-04 | Create package scaffold                     |
| v0.3.0  | 2026-04 | Remove with patch rollback                  |
| v0.2.0  | 2026-04 | Baseline tracking                           |
| v0.1.0  | 2026-04 | MVP: init, preview, install, remove, doctor |
