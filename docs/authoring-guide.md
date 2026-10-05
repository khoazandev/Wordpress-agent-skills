# Authoring Guide

## Directory Naming & Layout
- Name: 1-64 kebab-case chars. No double dashes `--` or trailing/leading dashes.
- Layout: Contains `SKILL.md`. Auxiliary files inside `scripts/`, `references/`, `tests/`.

## Frontmatter Requirements
- Must use strict single-line frontmatter for compatibility with simple parsers.
- `description` is ALWAYS a single-line double-quoted string.
- `name` and `compatibility` are single-line scalars.

## Routing
- Register new skills in `wp-agency-router` (V5) so agents know when to use them.

## Skill Content
- Include a Verification section in each `SKILL.md`.

## Setup & Validation
- Run `npm run setup-hooks` right after clone.
- Run `npm run validate && npm test` before committing.
- Validation Rules:
  - V1: Directory name formatting and metadata length limits.
  - V2: `description` format check.
  - V3: PII/Data leakage check.
  - V4: Plugin manifest validation.
  - V5: Router registration check.
  - V6: No UTF-16 files (e.g., from PowerShell Out-File).
