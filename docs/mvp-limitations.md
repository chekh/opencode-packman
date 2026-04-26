# v1.0.0 Limitations

Current version intentionally does not include:

- remote package registry
- dependency resolver
- semantic version ranges
- package rollback transactions
- automatic rollback of JSON patches on remove
- approval workflows
- web UI / marketplace integration
- binary distribution
- package signing
- MCP risk scoring

Operational limitations:

- lockfile ownership drives remove behavior
- if lockfile is manually edited incorrectly, doctor/remove may report errors
- `opencode.json` patch removal is manual

Manual rollback note:

When a package is removed, `opencode.json` is not reverted automatically.
Review and edit `opencode.json` manually if patch values should be undone.

## Future considerations

These features may be considered for future releases:

- Remote registry (HTTP/HTTPS)
- Git-based registries
- Automatic JSON patch rollback with snapshots
- Semver range resolution
- Package signing and verification
