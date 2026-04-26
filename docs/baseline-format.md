# Baseline Format

Baseline tracks the initial state of project files before any package installations.

## Location

```
.opencode-packman/baseline.yaml
```

Created automatically by `opm init` in project root.

## Purpose

Baseline enables:

1. **Checksum verification** — detect manual changes to installed files
2. **Integrity checking** — `opm doctor` can verify baseline files haven't been corrupted
3. **Future rollback support** — baseline provides reference point for project restoration

## Schema

```yaml
schema: opencode-packman/baseline/v1
createdAt: 2026-04-26T12:00:00.000Z
files:
  opencode.json:
    checksum: sha256:abc123...
  .opencode/agents/custom.md:
    checksum: sha256:def456...
```

## Sections

### `schema`

Must be exactly `opencode-packman/baseline/v1`.

### `createdAt`

ISO 8601 timestamp when baseline was created.

### `files`

Map of file paths (relative to project root) to checksum entries:

- `checksum`: SHA-256 checksum prefixed with `sha256:`

## Checksums

All checksums use SHA-256 algorithm with format:

```
sha256:<64-character-hex-string>
```

Example:

```
sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Doctor integration

`opm doctor` compares current file checksums against baseline:

- **OK**: file unchanged (checksums match)
- **WARN**: file modified since baseline
- **ERROR**: baseline file missing

## When baseline is updated

Baseline is created once by `opm init` and is **not** automatically updated during install/remove operations.

If you want to update baseline (e.g., after intentional manual changes):

```bash
# Remove old baseline
rm .opencode-packman/baseline.yaml

# Re-run init to create fresh baseline
opm init
```

## Global scope

For global installations, baseline is stored at:

```
~/.config/opencode/.opencode-packman/baseline.yaml
```

Same format applies.

## Schema version

Current schema: `opencode-packman/baseline/v1`

The schema field is required and must match exactly. Future versions may introduce schema upgrades.
