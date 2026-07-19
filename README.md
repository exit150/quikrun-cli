# quikrun

The QuikRun CLI. Scaffold, deploy, and run serverless snippets straight from your terminal. It is a thin client over the [QuikRun](https://quik.run) REST API.

## Quick start

```bash
npx quikrun new my-webhook
```

That registers a snippet, downloads its starter code into `./my-webhook/`, and hands you the next steps:

```bash
cd my-webhook
# edit snippet.js
quikrun run      # test it
quikrun deploy   # ship it live
```

## Install

Run it on demand with `npx quikrun <command>`, or install globally:

```bash
npm install -g quikrun
```

Requires Node.js 20 or newer.

## Authentication

1. Mint a token in the **quik.run dashboard → Tokens**.
2. Save it:

   ```bash
   quikrun login quik_xxxxxxxxxxxx
   ```

The token is stored in `~/.quikrun/config.json` (created `0700`, file `0600`). You can override it per-shell with the `QUIKRUN_TOKEN` env var, which always takes precedence.

## Configuration

| Env var            | Default                 | Purpose                          |
| ------------------ | ----------------------- | -------------------------------- |
| `QUIKRUN_API_URL`  | `https://api.quik.run`  | API base URL (staging / local).  |
| `QUIKRUN_TOKEN`    | —                       | Auth token, overrides the file.  |

Each scaffolded project holds a `quikrun.json`:

```json
{
  "slug": "my-webhook-a1b2",
  "language": "javascript",
  "runtime": "node20",
  "visibility": "private",
  "file": "snippet.js"
}
```

`deploy`, `pull`, and `run` read this file from the current directory.

## Commands

### `quikrun new [name]`

Scaffold a new snippet. Prompts for name, language, and visibility unless provided.

```bash
quikrun new                       # fully interactive
quikrun new my-webhook            # name given, prompts for the rest
quikrun new my-webhook --language typescript
quikrun new my-webhook --yes      # non-interactive, private JavaScript
```

Creates `./<name>/` with the source file, `quikrun.json`, and a `README.md`.

### `quikrun login <token>`

Validate a token and save it.

```bash
quikrun login quik_xxxxxxxxxxxx
```

### `quikrun deploy`

Save the local source to the snippet's latest version and deploy it live.

```bash
quikrun deploy
```

### `quikrun pull`

Overwrite the local source file with the currently deployed code.

```bash
quikrun pull
```

### `quikrun run [--body <json>] [--method <m>]`

Execute the local source with a test payload and print the status, output, and logs.

```bash
quikrun run
quikrun run --method POST --body '{"name":"ada"}'
```

### `quikrun list`

List every snippet in your team.

```bash
quikrun list
```

### `quikrun logs`

Show recent run and deploy events for your team.

```bash
quikrun logs
```

## Development

```bash
npm install
npm run dev -- new my-snippet   # run from source via tsx
npm run typecheck               # tsc --noEmit
npm run build                   # emit dist/
```

## License

MIT
