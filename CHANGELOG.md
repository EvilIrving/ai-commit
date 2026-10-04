# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.6] - 2026-10-04

### Changed

- Moved local development and debugging instructions out of the README into `CONTRIBUTING.md`, which now also maps each source file to its job
- Documented that generated messages are Chinese unless `.ai-commitrc` sets `language`, and pointed at `.ai-commitrc.example`
- Replaced the emoji-led feature list with plain bullets

### Fixed

- Corrected the repository path in the development instructions (`node-ai-commit` is now `ai-commit`)

## [1.1.5] - 2026-08-26

### Added

- Linked the npm package back to the GitHub repository (`repository`, `homepage`, `bugs`)
- Pointed the README and CLI signature back to the GitHub repo; Light Stats is mentioned only as a related project
- Printed a short repo signature after a successful CLI generation
- Accepted common OpenAI-compatible env names (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`)
- Loaded `.env` from the git root and `~/.ai-commit.env`, not only the current directory
- Added `AI_TIMEOUT_MS` and optional Azure `OPENAI_API_VERSION`
- Default model is now `gpt-5.6-luna`; DeepSeek (`deepseek-v4-flash`) is documented as an OpenAI-compatible option
- Commit generation asks for `reasoning_effort: none`, then retries without that field if the endpoint rejects it

### Fixed

- Removed a machine-local `simple-git-hooks` path from `package.json`
- Added the MIT `LICENSE` file listed in the published package
- Stopped treating CLI flags as the commit-message file path
- Skipped generation for merge, squash, and amend commits
- Stopped stripping fenced model output down to an empty first line
- Kept git comment lines when writing `COMMIT_EDITMSG`
- Used `execFile` for git so diffs with special characters are not lost
- Redacted API keys in `--verbose` output

## [1.1.4] - 2025-12-31

### Changed

- Simplified AI provider support
  - Now only supports OpenAI and OpenAI-compatible APIs
  - Removed DashScope (Qwen) adapter
- Updated README with better usage documentation

### Fixed

- Fixed git hook not generating commit messages
  - Hook script now passes arguments to ai-commit.js ("$@")
  - Fixed detection logic for existing commit messages
  - Only skips generation if file contains user-provided content (non-comment lines)
- Simplified commit message file path detection
  - Removed unused environment variables (GIT_PARAMS, COMMIT_MESSAGE_FILE)
- Removed unused configuration options (AI_TEMPERATURE, AI_MAX_TOKENS)

## [1.1.3] - 2025-12-31

- Fixed git hook not generating commit messages
  - Hook script now passes arguments to ai-commit.js ("$@")
  - Fixed detection logic for existing commit messages
  - Only skips generation if file contains user-provided content (non-comment lines)
- Simplified commit message file path detection
  - Removed unused environment variables (GIT_PARAMS, COMMIT_MESSAGE_FILE)
- Removed unused configuration options (AI_TEMPERATURE, AI_MAX_TOKENS)

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
