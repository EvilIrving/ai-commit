# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2025-12-30

### Fixed

- Fixed `bin/install.js` to use dynamic paths instead of `npx`
  - Avoids `npx` resolution issues when package is installed in nested node_modules
  - Uses absolute paths based on script location for git hook configuration

## [1.1.1] - 2025-12-30

### Fixed

- Fixed import path issue in `bin/ai-commit.js` when installed via pnpm
  - Changed `./dist/` to `../dist/` for correct module resolution

## [1.1.0] - 2025-12-30

### Added

- Support for `.ai-commitrc` configuration file
  - YAML/JSON format support for custom prompts
  - Search order: current directory → home directory
  - Environment variable `AI_COMMITRC_PATH` for custom path
- Custom prompt templates with variables:
  - `{{diff}}` - git diff (auto-truncated)
  - `{{branch}}` - current branch name
  - `{{lastCommit}}` - previous commit message
- Multi-language support:
  - System prompt customization
  - User prompt template customization
  - Mixed language prompts (e.g., Chinese description + English body)

### Changed

- Updated dependencies:
  - Added `js-yaml` for YAML config parsing
  - Added `@types/js-yaml` for TypeScript support

## [1.0.0] - 2025-12-30

### Added

- Initial release
- AI-powered commit message generation
- Support for OpenAI-compatible APIs
- Support for DashScope (Alibaba Qwen)
- Conventional commits format
- Customizable temperature and max tokens
