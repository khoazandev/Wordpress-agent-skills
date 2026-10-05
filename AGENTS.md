# Agent Guidelines for Contributors

- **Setup Hooks:** Always run `npm run setup-hooks` right after clone, BEFORE your first commit.
- **Validation:** Always ensure `npm run validate && npm test` pass before committing.
- **Privacy:** Absolutely NO personal paths (e.g., Windows user directories) and NO client/project names in any commit. Use `~` or `<project>`.
- **Merging Forks:** When merging a fork PR, run `npm run validate -- --history` locally on that branch first because fork CI has no denylist.
- **Authoring:** See [Authoring Guide](docs/authoring-guide.md) for skill format and directory layout requirements.
- **Safety:** Never write files with tools that emit UTF-16 (e.g., PowerShell Out-File). Never use `--no-verify`.
