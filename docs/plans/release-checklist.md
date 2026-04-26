# Release Checklist

This document describes the verification process for releasing a new version of `opencode-packman`.

## Automated Checks

Run all automated checks before tagging a release:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm smoke
```

All commands must pass with exit code 0.

## Manual Checks

After automated checks pass, manually verify core workflows:

### Project Initialization

```bash
mkdir /tmp/opm-release-test
cd /tmp/opm-release-test

opm init
```

Verify:

- `opencode.json` exists
- `.opencode/agents/`, `.opencode/commands/`, `.opencode/skills/` directories exist
- `.opencode-packman/lock.yaml` exists
- `.opencode-packman/baseline.yaml` exists

### Package Creation

```bash
opm package create test-bundle
```

Verify:

- `test-bundle/package.yaml` exists and is valid YAML
- `test-bundle/agents/test-bundle-reviewer.md` exists
- `test-bundle/commands/test-bundle-review.md` exists
- `test-bundle/skills/test-bundle-skill/SKILL.md` exists with valid frontmatter

### Package Validation

```bash
opm package validate ./test-bundle
```

Verify:

- Validation passes
- No errors reported

### Registry and Publish

```bash
opm registry add test-registry /tmp/test-registry
opm package publish ./test-bundle --registry test-registry
opm registry packages test-registry
```

Verify:

- Registry is added
- Package appears in registry listing
- Package files exist in registry directory

### Force Publish (Stale File Test)

```bash
# Add extra file
echo "extra" > ./test-bundle/extra.txt

# Publish with force
opm package publish ./test-bundle --registry test-registry --force

# Remove extra file
rm ./test-bundle/extra.txt

# Publish with force again
opm package publish ./test-bundle --registry test-registry --force
```

Verify:

- `extra.txt` does NOT exist in published registry package (stale file removed)

### Install and Doctor

```bash
cd /tmp/opm-release-test

opm install test-registry/test-bundle --yes
opm doctor
```

Verify:

- Install completes without errors
- Doctor reports "healthy" status
- Installed files exist in `.opencode/`

### Remove

```bash
opm remove test-bundle --yes
opm doctor
```

Verify:

- Remove completes without errors
- Owned files are deleted
- Doctor reports healthy status (no orphan references)

### Package Test (Sandbox)

```bash
opm package test test-registry/test-bundle
```

Verify:

- Sandbox test passes
- All steps show OK status
- Temp sandbox is cleaned up

### Global Scope (Optional)

```bash
opm init --global
opm doctor --global
```

Verify:

- Global config directory is created at `~/.config/opencode/`
- Doctor reports healthy status for global scope

## Version Update

Update version in all `package.json` files:

- `package.json` (root)
- `packages/core/package.json`
- `packages/schemas/package.json`
- `apps/cli/package.json`

Update `CHANGELOG.md` with release date and changes.

## Tagging

After all checks pass:

```bash
git checkout main
git tag v<version>
git push origin main --tags
```

## Post-Release

1. Verify tag exists on GitHub
2. Update roadmap to mark release complete
3. Announce release (if applicable)
