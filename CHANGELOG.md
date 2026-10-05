# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-05
### Added
- Initial release with 5 skills: wp-agency-router, flatsome-css-architecture, flatsome-uxbuilder-design, wordpress-functions-zero-hardcode, wordpress-packaging-handover.
- Zero-dependency ESM installer script (`scripts/install.mjs`) supporting global and per-project installation.
- Validation script (`scripts/validate-skills.mjs`) and Git hooks (`setup-hooks`) to enforce privacy, data sanitization, and YAML frontmatter standards.
- Plugin manifests for Antigravity, Claude Code, and Codex.
- GitHub Actions CI workflows.

### Changed
- The packaging bundler and cleaner now exclude agent/IDE metadata directories (`.idea`, `.gemini`, `.claude`, `.codex`, `.agents`, `.cursor`) from client packages. Previously, only `.vscode` was excluded from staging, and `.gemini`, `.vscode`, `.idea` were ignored by the cleaner.
