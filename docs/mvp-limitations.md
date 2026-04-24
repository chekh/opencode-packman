# MVP Limitations

Current MVP intentionally does not include:

- global scope install/remove
- remote package registry
- dependency resolver
- semantic version ranges
- package rollback transactions
- automatic rollback of JSON patches on remove
- approval workflows
- web UI / marketplace integration
- binary distribution

Operational limitations:

- lockfile ownership drives remove behavior
- if lockfile is manually edited incorrectly, doctor/remove may report errors
- `opencode.json` patch removal is manual in MVP

Manual rollback note:

When a package is removed, `opencode.json` is not reverted automatically.
Review and edit `opencode.json` manually if patch values should be undone.
