# Authoring Guide

## Directory Naming & Layout
- Name: 1-64 kebab-case chars. No double dashes `--` or trailing/leading dashes.
- Layout: Contains `SKILL.md`. Auxiliary files inside `scripts/`, `references/`, `templates/`, `tests/` (test files must match `tests/test_*.mjs` to be picked up by `npm test`).

### Layout Example
```text
skills/my-new-skill/
├── SKILL.md
├── references/
│   └── api-docs.md
├── scripts/
│   └── tool.mjs
├── templates/
│   └── config.tpl
└── tests/
    └── test_tool.mjs
```

## Frontmatter Requirements
Must use strict single-line frontmatter for compatibility with simple parsers.
- **Spec §8.1 Strict Subset**: Only `\"` and `\\` escapes are allowed. Plain scalars must not start with `'`, `"`, `>`, `|`, `[`, `{`, `&`, `*`, `!` nor contain `: ` or ` #`. No multi-line or block scalars. Error message for users failing this typically shows as parse errors or validation failures.
- `description` is ALWAYS a single-line double-quoted string.
- `name` and `compatibility` are single-line scalars.

### Valid Frontmatter Example
```yaml
---
name: my-new-skill
description: "Handles: special tasks and workflows."
compatibility: "WordPress 6.0+, PHP 7.4+"
---
```

## Skill Content & Routing
- Register new skills in `wp-agency-router` (V5) so agents know when to use them.
- Include a minimal "Verification" section in each `SKILL.md`.

### Verification Example
```markdown
## Verification
Before completing a task, always run:
`npm run test`
Do not declare the task is done unless tests pass.
```

## Setup & Validation
- Run `npm run setup-hooks` right after clone, BEFORE your first commit.
- Run `npm run validate && npm test` before committing.

### Validation Rules (V1–V6)
- **V1**: Name length must be 1-64 kebab-case. Description length must be 1-1024 characters. Compatibility must be specified (1-500 characters).
- **V2**: Relative path tokens starting with `references/`, `scripts/`, `templates/` or `./` must exist inside the skill dir.
- **V3**: PII/Data leakage check. Validates against personal path patterns and private denylist (with `validate-allow-path` line marker and `tests/fixtures/` exemption for patterns only).
- **V4**: Plugin manifest validation (name and version must match `package.json`).
- **V5**: Router registration check (all skills must be mentioned in `wp-agency-router/SKILL.md`).
- **V6**: Valid UTF-8, no BOM, no UTF-16 files (e.g. from PowerShell Out-File), applies to hook scripts too.

## Steps to add a new skill
1. Create directory `skills/<name>`
2. Create `SKILL.md` with valid frontmatter.
3. Register the new skill in `skills/wp-agency-router/SKILL.md`.
4. Run `npm run validate`.
5. Run `npm test`.
