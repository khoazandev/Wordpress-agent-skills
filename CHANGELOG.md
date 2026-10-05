# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - Unreleased
### Changed
- The packaging bundler and cleaner now exclude agent/IDE metadata directories (`.idea`, `.gemini`, `.claude`, `.codex`, `.agents`, `.cursor`) from client packages. Previously, only `.vscode` was excluded from staging, and `.gemini`, `.vscode`, `.idea` were ignored by the cleaner.
