# quikrun

The QuikRun CLI. Scaffold, run, and deploy [QuikRun](https://quik.run) snippets straight from your terminal.

QuikRun runs single-file snippets at the edge, each on its own URL (`quik.run/r/<slug>`). The CLI is a thin client over the QuikRun REST API.

## Install

Run it on demand with `npx`, or install globally so you can drop the prefix:

```bash
npm install -g quikrun      # then just: quikrun <command>
# or, no install:
npx quikrun <command>
```

Requires Node.js 20 or newer.

> Heads up: if you use `npx`, prefix **every** command with `npx` — npx runs the CLI without adding `quikrun` to your PATH, so a bare `quikrun ...` will be "command not found". Install globally to type `quikrun` directly.

## Sign in

```bash
quikrun login
```

This opens your browser, you click **Authorize**, and the CLI receives a token automatically. No copy-paste, no dashboard trip. The token is saved to `~/.quikrun/config.json` (directory `0700`, file `0600`).

Headless or CI? Mint a token in the **quik.run dashboard → Tokens** and pass it, or set it in the environment:

```bash
quikrun login quik_xxxxxxxxxxxx
# or
export QUIKRUN_TOKEN=quik_xxxxxxxxxxxx   # always takes precedence
```

## Quick start

```bash
quikrun login              # browser sign-in
quikrun new my-webhook     # scaffold + register a snippet
cd my-webhook
# edit snippet.js
quikrun run                # test it against the sandbox
quikrun deploy             # ship it live at quik.run/r/<slug>
```

## Configuration

| Env var           | Default                | Purpose                          |
| ----------------- | ---------------------- | -------------------------------- |
| `QUIKRUN_API_URL` | `https://api.quik.run` | API base URL (staging / local).  |
| `QUIKRUN_WEB_URL` | `https://quik.run`     | Web app base (browser sign-in).  |
| `QUIKRUN_TOKEN`   | —                      | Auth token, overrides the file.  |

Each scaffolded project holds a `quikrun.json`, read by `deploy`, `pull`, and `run`:

```json
{
  "slug": "my-webhook-a1b2",
  "language": "javascript",
  "runtime": "node:20",
  "visibility": "private",
  "file": "snippet.js"
}
```

## Commands

### `quikrun login [token]`

Sign in. With no argument it opens the browser and captures a token automatically. Pass a `quik_…` token to sign in headless.

### `quikrun new [name]`

Scaffold a new snippet. Prompts for name, language, and visibility unless provided.

```bash
quikrun new
quikrun new my-webhook --language typescript
quikrun new my-webhook --yes      # non-interactive defaults
```

Creates `./<name>/` with the source file, `quikrun.json`, and a `README.md`.

### `quikrun run [--body <json>] [--method <m>]`

Execute the local source with a test payload; prints the status, output, and logs.

```bash
quikrun run
quikrun run --method POST --body '{"name":"ada"}'
```

### `quikrun deploy`

Save the local source to a new version and deploy it live.

### `quikrun pull`

Overwrite the local source file with the currently deployed code.

### `quikrun list`

List every snippet in your team.

### `quikrun logs`

Show recent run and deploy events for your team.

## What runs

Snippets are single-file JavaScript or TypeScript that export a default `async handler(req, env)` and return JSON or an HTTP response. They execute in a sandbox at the edge and can `import` from a curated set of npm packages (dayjs, zod, cheerio, marked, and more), plus server-render HTML. See [quik.run](https://quik.run) for the current package list and limits.

## Development

```bash
npm install
npm run dev -- new my-snippet   # run from source via tsx
npm run typecheck               # tsc --noEmit
npm run build                   # emit dist/
```

## License

MIT
