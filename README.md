# WordPress Agent Skills

[Tiếng Việt](README.vi.md)

Multi-agent WordPress skill pack for Antigravity, Claude Code, and Codex. Specifically tailored for agency/client WordPress work, Flatsome child themes, and handovers.

## Installation

| Agent | Command | Update Command |
|---|---|---|
| **Antigravity** | `git clone https://github.com/khoazandev/Wordpress-agent-skills ~/.gemini/config/plugins/wordpress-agent-skills` | `git -C ~/.gemini/config/plugins/wordpress-agent-skills pull` |
| **Claude Code** | `/plugin marketplace add khoazandev/Wordpress-agent-skills` then `/plugin install wordpress-agent-skills@wordpress-agent-skills` | `/plugin marketplace update wordpress-agent-skills` |
| **Codex** | `npx github:khoazandev/Wordpress-agent-skills --agents=codex` (or alternatively, not yet verified: `codex plugin marketplace add khoazandev/Wordpress-agent-skills` + `codex plugin add wordpress-agent-skills`) | Rerun install |
| **Project Repos** | `npx github:khoazandev/Wordpress-agent-skills --project .` (commit the created `.agents/skills` dir) | Rerun install |

## Installer Options

Usage:
```
Usage:
node scripts/install.mjs [options]
npx github:khoazandev/Wordpress-agent-skills [options]

--agents=<list>     antigravity,claude,codex (default: all three)
--project=<path>    install into project repo instead of global
--skills=<list>     install only specified skills (default: all)
--dry-run           print plan, do not write
--uninstall         remove skills installed by this tool
--force             replace unmanaged dirs with a backup / ignore plugin detection
--help

Exit codes: 0 ok, 1 error, 2 conflicts remain
```

Exit codes: 0 (success), 1 (error), 2 (unresolved conflicts remain: existing skill dirs without our marker were left untouched).

### Safety
- **Marker File**: Installed skills contain a `.wordpress-agent-skills.json` marker with package, version, and installedAt info (no paths).
- **Actions**: The installer reports actions for each skill as `new` (creates dir), `update` (updates marked dir), `conflict` (unmarked dir exists, requires `--force`), or `skip-plugin` (skipped due to active plugin management).
- **Backups**: Using `--force` moves the conflicting unmanaged directory to `~/.wordpress-agent-skills/backups/<timestamp>/<agent>/<name>/` before installing.
- **Atomic Operations**: Installation uses staging directories and atomic renaming.
- **Recommendation**: Always run with `--dry-run` first to preview changes.

### Installation Targets
| Agent | Global Target | Project Target (`--project`) |
|---|---|---|
| **Antigravity** | `~/.gemini/config/skills` (or `~/.gemini/antigravity/skills`) | `.agents/skills` |
| **Claude Code** | `~/.claude/skills` | `<project>/.claude/skills` |
| **Codex** | `~/.codex/skills` | `.agents/skills` |

## Skill Inventory

- **wp-agency-router**: Agency/client router. Example trigger: "Help me with a Flatsome WordPress task."
- **flatsome-css-architecture**: CSS rules for Flatsome child themes. Example trigger: "Fix the CSS layout on my Flatsome site."
- **flatsome-uxbuilder-design**: Design structure for UX Builder. Example trigger: "Create a new section using UX Builder."
- **wordpress-functions-zero-hardcode**: Zero hardcode rules for functions.php. Example trigger: "Add a shortcode for business data in functions.php."
- **wordpress-packaging-handover**: Project handover and packaging. Example trigger: "Package this WordPress site for handover."

## Using with WordPress/agent-skills
This skill pack defers to the upstream official `wordpress-router` for core, REST API, block themes, etc. No upstream skills are vendored here.

## Requirements
- Node.js >= 20.
- PHP and mysqldump only required for `wordpress-packaging-handover`.

## Uninstall
Use `--uninstall` to automatically remove all skill directories that contain the installation marker.

For full removal of the plugin registrations:
- **Antigravity**: Delete `~/.gemini/config/plugins/wordpress-agent-skills`.
- **Claude Code**: Run `/plugin uninstall wordpress-agent-skills@wordpress-agent-skills`.

## Contributing
- Run `npm run setup-hooks` right after clone, BEFORE your first commit.
- Run `npm run validate && npm test` before committing.
- When merging a fork PR, run `npm run validate -- --history` locally.
- See the [Authoring Guide](docs/authoring-guide.md) and [AGENTS.md](AGENTS.md) for more details.

## License
MIT