# WordPress Agent Skills

[Tiếng Việt](README.vi.md)

Multi-agent WordPress skill pack for Antigravity, Claude Code, and Codex. Specifically tailored for agency/client WordPress work, Flatsome child themes, and handovers.

## Installation

| Agent | Command | Update Command |
|---|---|---|
| **Antigravity** | `git clone https://github.com/khoazandev/Wordpress-agent-skills ~/.gemini/config/plugins/wordpress-agent-skills` | `git -C ~/.gemini/config/plugins/wordpress-agent-skills pull` |
| **Claude Code** | `/plugin marketplace add khoazandev/Wordpress-agent-skills` then `/plugin install wordpress-agent-skills@wordpress-agent-skills` | `/plugin marketplace update wordpress-agent-skills` |
| **Codex** | `npx github:khoazandev/Wordpress-agent-skills --agents=codex` (or alternatively `codex plugin marketplace add khoazandev/Wordpress-agent-skills` + `codex plugin add wordpress-agent-skills`) | Rerun install |
| **Project Repos** | `npx github:khoazandev/Wordpress-agent-skills --project .` (commit the created `.agents/skills` dir) | Rerun install |

## Installer Options

Usage:
```
node scripts/install.mjs [options]
npx github:khoazandev/Wordpress-agent-skills [options]

--agents=<list>     antigravity,claude,codex (mặc định: cả 3)
--project=<path>    cài vào repo dự án thay vì global
--skills=<list>     chỉ cài một số skill (mặc định: tất cả)
--dry-run           in kế hoạch, không ghi
--uninstall         gỡ các skill do tool này cài
--force             thay thế thư mục không có marker (luôn backup) / bỏ qua cảnh báo plugin
--help
```

Exit codes: 0 (success), 1 (error), 2 (warning).
Safety: Backups for `--force` are stored in `~/.wordpress-agent-skills/backups/`.

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
Use `--uninstall` to remove installed skills per agent or remove the plugin directories.

## Contributing
- Run `npm run setup-hooks` right after clone.
- Run `npm run validate && npm test` before committing.
- When merging a fork PR, run `npm run validate -- --history` locally.

## License
MIT