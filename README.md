# @light-cat/ai-commit-msg

AI-powered commit message generator for git. Automatically generates conventional commit messages based on your staged changes.

## Features

- 🤖 **AI-powered**: Uses AI to analyze your code changes and generate meaningful commit messages
- 📝 **Conventional Commits**: Follows the [Conventional Commits](https://www.conventionalcommits.org/) format
- 🔧 **Easy Configuration**: Simple `.env` setup with environment variable support
- 🛡️ **Safe**: Doesn't block commit on errors - falls back gracefully
- 🔌 **Flexible AI Support**: Works with OpenAI, Azure, DashScope (Qwen), and any OpenAI-compatible API
- ⚡ **CLI Ready**: Can be used directly with `npx` or installed globally

## Installation

### Local Installation (Recommended)

```bash
# Install as a development dependency
npm install --save-dev @light-cat/ai-commit-msg

# Set up git hooks (installs simple-git-hooks if needed)
npx ai-commit install:hooks
```

### Global Installation

```bash
npm install -g @light-cat/ai-commit-msg

# Then set up git hooks in your project
cd /path/to/your/project
npx ai-commit install:hooks
```

## Configuration

Create a `.env` file in your project root or set environment variables:

```env
# Required
AI_API_KEY=your-api-key-here

# Optional (defaults shown)
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4

# Optional tuning
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=100
```

### Supported AI Providers

| Provider | `AI_API_BASE_URL` | `AI_MODEL` |
|----------|-------------------|------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4`, `gpt-3.5-turbo` |
| Azure OpenAI | Your Azure endpoint | Your deployment name |
| DashScope (Qwen) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo`, `qwen-plus` |
| Local/Other | Your custom endpoint | Any OpenAI-compatible model |

### Getting API Keys

- **OpenAI**: Get your API key from [platform.openai.com](https://platform.openai.com)
- **DashScope (Qwen)**: Get your API key from [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com)

## Usage

### Automatic Setup

```bash
# Install hooks and configure simple-git-hooks automatically
npx ai-commit install:hooks
```

### Manual Setup (if you already have simple-git-hooks)

Add to your `package.json`:

```json
{
  "simple-git-hooks": {
    "prepare-commit-msg": "npx ai-commit"
  }
}
```

Or if using `lefthook`:

```yaml
# lefthook.yml
pre-commit:
  commands:
    generate-commit-msg:
      run: npx ai-commit
```

### Standalone Usage

```bash
# Dry run (show message without writing)
npx ai-commit --dry-run

# Verbose mode (show debug info)
npx ai-commit --verbose

# Help
npx ai-commit --help
```

## How It Works

1. When you run `git commit`, the `prepare-commit-msg` hook is triggered
2. The tool fetches:
   - Staged changes (`git diff --cached`)
   - Current branch name
   - Last commit message (if available)
3. Sends this information to the AI service
4. Generates a conventional commit message
5. Writes it to the commit message file

## Example

Given this staged change:

```diff
diff --git a/src/auth.ts b/src/auth.ts
+export function validateEmail(email: string): boolean {
+  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
+}
```

The tool might generate:

```
feat(auth): add email validation function
```

## Troubleshooting

### "AI_API_KEY is not set"

Make sure your `.env` file exists and contains `AI_API_KEY`, or set the environment variable before committing.

### Commit message not being generated

1. Check if changes are staged (`git add` first)
2. Run with `--verbose` to see debug information
3. Ensure your API key has sufficient credits/permissions
4. Verify git hooks are installed: `cat .git/hooks/prepare-commit-msg`

### Want to use a custom message?

Simply provide a commit message when running `git commit -m "your message"` - the tool will detect an existing message and skip generation.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.