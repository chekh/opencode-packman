# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-26

### Added

- Structured JSON output for key CLI commands via `--json` flag:
  - `opm package validate --json` — machine-readable validation results
  - `opm package inspect --json` — package manifest in JSON
  - `opm preview --json` — InstallPlan in JSON
  - `opm doctor --json` — DoctorReport in JSON
  - `opm project status --json` — ProjectStatusResult in JSON
  - `opm registry packages --json` — package summaries in JSON
  - `opm search --json` — search results in JSON
- JSON output helper (`apps/cli/src/commands/jsonOutput.ts`) with `printJson`, `formatValidationIssues`, `formatDoctorIssues`
- Unit tests for JSON output helper (`apps/cli/src/commands/jsonOutput.test.ts`)

### Docs

- Added "Structured JSON output" section to `docs/guides/cli.md`
- Updated `docs/plans/roadmap.md` with v1.1.0 milestone

## [1.0.1] - 2026-04-26

### Fixed

- `opm package publish --force` now removes the existing target directory before copying the new package, preventing stale files from remaining in published registry packages.

### Docs

- Added "Model alias behavior" section to `docs/package-format.md` explaining that aliases are recorded in lockfile metadata but not compiled into file content.
- Updated README feature list to accurately reflect v1.0.0 capabilities including `--revert-patches` and safety features.
- Corrected CLI command name in README table: `opm package publish` (not `opm publish`).

## [1.0.0] - 2026-04-26

### Added

- JSON schemas for all formats (`package.schema.json`, `lock.schema.json`, `baseline.schema.json`, `registry.schema.json`).
- `docs/baseline-format.md` - Baseline format documentation.
- `docs/registry-format.md` - Registry format documentation.
- `docs/migration.md` - Migration notes between versions.
- Model aliases with lockfile recording (`modelAlias`, `resolvedModel` fields).
- Package sandbox testing via `opm package test <packageRef>`.
- Global scope support: `opm init --global`, `opm install --global`, `opm doctor --global`, `opm remove --global`.
- File checksums in lockfile for integrity verification.
- Safety features: path boundary checks, symlink validation, backup/rollback on install failure.
- Patch snapshots for `--revert-patches` on remove.
- Local registry workflow: `opm registry add/list/remove/packages`.
- Package authoring: `opm create package`, `opm package validate`, `opm package publish`.
- Search across registries: `opm search [query] [--tag] [--type]`.
- Doctor checks: baseline drift, checksum verification, model alias validation, ownership consistency.

### Changed

- Version bumped to 1.0.0 across all packages.
- Lockfile now includes `scope` field to distinguish project vs global installations.
- Baseline tracks files only, not empty directories.

## [0.9.0] - 2026-04-26

### Added

- `opm package test <packageRef>` - Structural sandbox test for packages.

## [0.8.0] - 2026-04-26

### Added

- Global scope support for all relevant commands.
- Scope-aware doctor and remove.

## [0.7.0] - 2026-04-26

### Added

- Safety upgrades: path boundary validation, symlink checks.
- Patch snapshots for JSON config rollback.
- `opm remove --revert-patches` to restore pre-patch `opencode.json`.

## [0.6.0] - 2026-04-26

### Added

- Model aliases: `opm model set/list/remove`.
- Install-time alias resolution and lockfile recording.

## [0.5.0] - 2026-04-26

### Added

- File checksums in lockfile.
- Doctor checksum drift detection.

## [0.4.0] - 2026-04-26

### Added

- Package metadata fields: `tags`, `author`, `license`, `compatibility`, `env`, `risk`.

## [0.3.0] - 2026-04-26

### Added

- `opm create package <name>` - Package scaffolding.
- `opm package publish` - Publish to local registry.

## [0.2.0] - 2026-04-26

### Added

- Resource model: project state, user config, registry storage, package draft.
- Baseline tracking for pre-install state.
- `opm project status` command.
- `opm config paths` command.

## [0.1.0] - 2026-04-26

### Added

- Initial MVP implementation.
- `opm init` - Initialize project layout.
- `opm preview <packageRef>` - Show install plan.
- `opm install <packageRef>` - Install package.
- `opm remove <packageName>` - Remove package.
- `opm doctor` - Health checks.
- Lockfile for ownership tracking.
- Package loading and validation.
- Install plan with conflict detection.
