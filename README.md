# @light-cat/ai-commit-msg

Generates a commit message from your staged changes, so you can run `git commit` and get a
conventional commit message without writing one.

```bash
# Stage something
git add .

# Commit without a message. The message is generated for you.
git commit
```

You get something like:

```
feat(auth): add email validation function
```

## Features

- Reads the staged diff, the branch name, and the previous commit message
- Writes a [Conventional Commits](https://www.conventionalcommits.org/) message
- Works with OpenAI, DeepSeek, Azure OpenAI, and any OpenAI-compatible endpoint
- If the API call fails, the commit goes through with an empty message instead of blocking you
- A message you pass with `git commit -m` is left alone

## Installation

Install it in the project you want it for, then register the git hook:

```bash
# npm
npm install --save-dev @light-cat/ai-commit-msg

# or pnpm
pnpm add --save-dev @light-cat/ai-commit-msg

# Registers the prepare-commit-msg hook (installs simple-git-hooks if you do not have it)
pnpm exec ai-commit setup
```

Or install it globally and set up each project:

```bash
npm install -g @light-cat/ai-commit-msg

cd /path/to/your/project
pnpm exec ai-commit setup
```

## Configuration

Put a `.env` in the git root, or `~/.ai-commit.env` for a key you want everywhere. Environment
variables you set yourself still take priority.

```env
# Required. OPENAI_API_KEY is also accepted.
AI_API_KEY=your-api-key-here

# Optional. Defaults shown.
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-5.6-luna
AI_TIMEOUT_MS=30000
AI_REASONING_EFFORT=low
```

`OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` are accepted as aliases.

### Reasoning effort

Requests go to the [Responses API](https://platform.openai.com/docs/api-reference/responses).
`AI_REASONING_EFFORT` controls how much the model reasons before answering, and defaults to `low`:

| Value | Effect |
| --- | --- |
| `none` | No reasoning. Fastest, and the cheapest for a task this small. |
| `low` | Default. A little reasoning, which helps when the diff mixes a feature and a refactor. |
| `medium` / `high` / `xhigh` / `max` | More reasoning. Slower and more expensive; rarely needed for a commit message. |

Endpoints that do not accept the parameter are retried once without it, so older gateways keep working.

### Supported providers

| Provider | `AI_API_BASE_URL` | `AI_MODEL` |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-5.6-luna` (default), or any chat model you have access to |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` or `deepseek-v4-pro` |
| Azure OpenAI | Your Azure endpoint | Your deployment name. Set `OPENAI_API_VERSION` if your endpoint needs it. |
| Local or other | Your OpenAI-compatible endpoint | The model name that endpoint expects |

### API keys

- OpenAI: [platform.openai.com](https://platform.openai.com)
- DeepSeek: [platform.deepseek.com](https://platform.deepseek.com/api_keys)

### Language of the generated message

**If you do not create a `.ai-commitrc`, messages are generated in Chinese.** To get English, create
`.ai-commitrc` in your project root or home directory with:

```yaml
language: en
```

The same file lets you replace the prompts entirely. See
[`.ai-commitrc.example`](.ai-commitrc.example) for the available variables (`{{diff}}`, `{{branch}}`,
`{{lastCommit}}`) and a full example of both languages.

## Usage

### Basic

After `ai-commit setup`, commit without a message:

```bash
git add .
git commit
```

The tool reads the staged changes, sends them to the model, and writes the result into the commit
message file.

### Automatic setup

```bash
pnpm exec ai-commit setup
```

This installs the hook and configures `simple-git-hooks` if your project does not already use it.

### Manual setup

If you already use `simple-git-hooks`, add this to `package.json`:

```json
{
  "simple-git-hooks": {
    "prepare-commit-msg": "pnpm exec ai-commit"
  }
}
```

With `lefthook`:

```yaml
# lefthook.yml
pre-commit:
  commands:
    generate-commit-msg:
      run: pnpm exec ai-commit
```

### Standalone

```bash
# Print the generated message without writing it
pnpm exec ai-commit --dry-run

# Show what is sent to the model
pnpm exec ai-commit --verbose

# Help
pnpm exec ai-commit --help
```

## How it works

1. `git commit` triggers the `prepare-commit-msg` hook.
2. The tool collects the staged diff (`git diff --cached`), the branch name, and the last commit
   message.
3. It sends those to the configured endpoint and asks for a conventional commit message.
4. The result is written to the commit message file.

The diff is sent to the model in full up to 8000 characters. Past that, the budget is spread across
the changed files instead of cutting the list short, so every file is still represented, and the
files whose diffs were trimmed are named at the end.

## Example

Staged change:

```diff
diff --git a/src/auth.ts b/src/auth.ts
+export function validateEmail(email: string): boolean {
+  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
+}
```

Generated message:

```
feat(auth): add email validation function
```

## Troubleshooting

### "AI_API_KEY is not set"

Check that `.env` exists in the git root and contains `AI_API_KEY`, or set it in your environment.

### No message is generated

1. Make sure something is staged. `git add` first.
2. Run `pnpm exec ai-commit --verbose` to see what happened.
3. Check that your API key has credit and access to the model.
4. Confirm the hook is installed: `cat .git/hooks/prepare-commit-msg`

### Using your own message

Pass one and the tool skips generation:

```bash
git commit -m "your message"
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development and debugging.

## License

MIT

---

Source: [github.com/EvilIrving/ai-commit](https://github.com/EvilIrving/ai-commit)

Also by the author: [Light Stats](https://github.com/EvilIrving/light-stats), a native macOS menu bar monitor.
