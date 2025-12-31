# @light-cat/ai-commit-msg

AI-powered commit message generator for git. Automatically generates conventional commit messages based on your staged changes.

## Features

- 🤖 **AI-powered**: Uses AI to analyze your code changes and generate meaningful commit messages
- 📝 **Conventional Commits**: Follows the [Conventional Commits](https://www.conventionalcommits.org/) format
- 🔧 **Easy Configuration**: Simple `.env` setup with environment variable support
- 🛡️ **Safe**: Doesn't block commit on errors - falls back gracefully
- 🔌 **Flexible AI Support**: Works with OpenAI, Azure, DashScope (Qwen), and any OpenAI-compatible API
- ⚡ **CLI Ready**: Can be used directly with `pnpm exec` or installed globally

## Installation

### Local Installation (Recommended)

```bash
# With npm
npm install --save-dev @light-cat/ai-commit-msg

# With pnpm
pnpm add --save-dev @light-cat/ai-commit-msg

# Set up git hooks (installs simple-git-hooks if needed)
pnpm exec ai-commit setup
```

### Global Installation

```bash
# With npm
npm install -g @light-cat/ai-commit-msg

# With pnpm
pnpm add -g @light-cat/ai-commit-msg

# Then set up git hooks in your project
cd /path/to/your/project
pnpm exec ai-commit setup
```

## Configuration

Create a `.env` file in your project root or set environment variables:

```env
# Required
AI_API_KEY=your-api-key-here

# Optional (defaults shown)
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4
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
pnpm exec ai-commit setup
```

### Manual Setup (if you already have simple-git-hooks)

Add to your `package.json`:

```json
{
  "simple-git-hooks": {
    "prepare-commit-msg": "pnpm exec ai-commit"
  }
}
```

Or if using `lefthook`:

```yaml
# lefthook.yml
pre-commit:
  commands:
    generate-commit-msg:
      run: pnpm exec ai-commit
```

### Standalone Usage

```bash
# Dry run (show message without writing)
pnpm exec ai-commit --dry-run

# Verbose mode (show debug info)
pnpm exec ai-commit --verbose

# Help
pnpm exec ai-commit --help
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

## Local Development

### Debugging

#### 1. Direct Source Execution

Run the source code directly with `tsx` (recommended for ESM projects):

```bash
cd /path/to/node-ai-commit
pnpm tsx bin/ai-commit.js --help
```

Or using the dev script:

```bash
pnpm dev -- --help
```

> **Note**: `ts-node` has limited ESM support. Use `tsx` instead for better compatibility.

#### 2. Using npm link

Link the local package globally and test in other projects:

```bash
cd /path/to/node-ai-commit
pnpm link

# In another project
cd /path/to/your-project
pnpm link @light-cat/ai-commit-msg
pnpm exec ai-commit setup
```

#### 3. Local Path Installation

In another project's `package.json`:

```json
{
  "devDependencies": {
    "@light-cat/ai-commit-msg": "link:/path/to/node-ai-commit"
  }
}
```

Then run `pnpm install` or `npm install` in that project.

#### 4. Build and Test

```bash
# Build the TypeScript
pnpm build

# Run locally (requires build first)
node bin/ai-commit.js --help

# Or run directly without building
pnpm tsx bin/ai-commit.js --help
```

### Testing Setup

1. Create a test repository:
```bash
mkdir test-ai-commit && cd test-ai-commit
git init
```

2. Link the local package:
```bash
cd /path/to/node-ai-commit
pnpm link --global

cd /path/to/test-ai-commit
pnpm link --global @light-cat/ai-commit-msg
```

3. Set up and test:
```bash
# Create .env with your API key
pnpm exec ai-commit setup

# Make some changes and commit
git add .
git commit -m "test"
```