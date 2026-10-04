# Contributing

Thanks for taking a look. Issues and pull requests are welcome.

## Local development

The package is TypeScript compiled to `dist/` and run through `bin/ai-commit.js`.

```bash
pnpm install
pnpm build          # tsc -> dist/
pnpm dev -- --help  # run from source with tsx
```

`pnpm dev` runs the CLI straight from source with `tsx`, so you can change `src/` and run again
without building. `bin/ai-commit.js` loads from `dist/`, so it needs a build first.

### Testing against a real repository

`npm link` is the quickest way to use your working copy in another project:

```bash
cd /path/to/ai-commit
pnpm link --global

cd /path/to/your-project
pnpm link --global @light-cat/ai-commit-msg
pnpm exec ai-commit setup
```

Then stage something and commit without a message. To unlink, run `pnpm unlink --global`.

If you would rather not touch the global link registry, point the dependency at the checkout
instead:

```json
{
  "devDependencies": {
    "@light-cat/ai-commit-msg": "link:/path/to/ai-commit"
  }
}
```

### Testing in a scratch repository

A throwaway repository is the safest place to try hook changes:

```bash
mkdir test-ai-commit && cd test-ai-commit
git init
pnpm link --global @light-cat/ai-commit-msg
pnpm exec ai-commit setup

# add a .env with your API key, then:
git add .
git commit
```

### Debugging

Run with `--verbose` to see what the tool sends and receives:

```bash
pnpm exec ai-commit --verbose
```

`--dry-run` prints the generated message without writing it, which is useful when you are iterating
on the prompt:

```bash
pnpm exec ai-commit --dry-run
```

## Where things live

| Path | What it holds |
| --- | --- |
| `src/config.ts` | Reading `AI_API_KEY`, base URL, model, timeout |
| `src/prompt.ts` | The default system prompts and the user prompt template |
| `src/rc-config.ts` | Loading `.ai-commitrc` |
| `src/ai.ts` | The API call and message cleanup |
| `src/git.ts` | Reading staged changes, branch, last commit |
| `bin/ai-commit.js` | The CLI entry point |
| `bin/install.js` | `ai-commit setup`, which wires the git hook |

[ARCHITECTURE.md](ARCHITECTURE.md) covers the design in more detail.

## Releasing

Versions are bumped in `package.json` and published to npm:

```bash
pnpm build
npm publish
```
