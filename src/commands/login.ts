/**
 * `quikrun login` — browser sign-in (loopback flow), like `wrangler login` / `vercel login`:
 * start a local server on 127.0.0.1:<port>, open quik.run/cli?port=…&state=…, the user approves,
 * the site redirects back to the loopback with the minted token, and we save it. `state` is a CSRF
 * guard the CLI generated. `quikrun login <token>` (paste a token) still works for headless use.
 */

import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import pc from "picocolors";
import { apiRequest, type SnippetListResponse } from "../api.js";
import { writeToken, configPath, WEB_URL } from "../config.js";
import { maskToken, CMD } from "../util.js";

export async function login(token?: string): Promise<void> {
  const pasted = token?.trim();
  if (pasted) {
    await saveAndValidate(pasted);
    return;
  }
  const result = await browserFlow();
  if (result.error || !result.token) {
    console.error(pc.red(`\n✖ Authorization ${result.error === "denied" ? "was cancelled" : "failed"}.`));
    process.exit(1);
  }
  await saveAndValidate(result.token);
}

/** Validate a token against the API (apiRequest exits on failure), then persist it. */
async function saveAndValidate(token: string): Promise<void> {
  await apiRequest<SnippetListResponse>("/api/snippets", { token });
  writeToken(token);
  console.log(pc.green(`\n✔ Logged in as ${pc.bold(maskToken(token))}`));
  console.log(pc.dim(`  Token saved to ${configPath}`));
  if (CMD === "npx quikrun") console.log(pc.dim(`\n  Tip: run 'npm i -g quikrun' so you can drop the 'npx'.`));
}

/** Loopback browser flow. Resolves with the token (or an error) captured on 127.0.0.1. */
function browserFlow(): Promise<{ token?: string; error?: string }> {
  const state = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const done = (msg: string, payload: { token?: string; error?: string }) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(resultPage(msg));
        server.close();
        clearTimeout(timer);
        resolve(payload);
      };
      if (url.searchParams.get("state") !== state) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(resultPage("Mismatched request. Close this tab and run login again."));
        return;
      }
      const tok = url.searchParams.get("token");
      const err = url.searchParams.get("error");
      if (tok) return done("You are signed in. Return to your terminal.", { token: tok });
      return done("Sign-in cancelled. Return to your terminal.", { error: err ?? "denied" });
    });

    server.on("error", reject);
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for authorization (3 min)."));
    }, 180_000);

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const authUrl = `${WEB_URL}/cli?port=${port}&state=${state}`;
      console.log("\nOpening your browser to authorize QuikRun…");
      console.log(pc.dim(`\n  If it doesn't open, visit:\n  ${pc.cyan(authUrl)}\n`));
      openBrowser(authUrl);
    });
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    /* headless / no browser — the user can copy the printed URL */
  }
}

function resultPage(message: string): string {
  return `<!doctype html><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>QuikRun CLI</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b0b0c;color:#eaeaea;font-family:system-ui,-apple-system,sans-serif"><div style="text-align:center"><div style="font-size:24px;font-weight:700">QuikRun<span style="color:#E6FF55">.</span></div><p style="margin-top:14px;color:#9a9ea6;font-size:15px">${message}</p></div></body>`;
}
