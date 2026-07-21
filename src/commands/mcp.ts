/**
 * `quikrun mcp install [client]` — connect the QuikRun MCP server to an AI client.
 *
 * Claude Code and VS Code are configured through their own CLIs (so we don't guess at
 * their config paths); Cursor, Windsurf, and Zed by merging their JSON config file,
 * preserving any servers already there. The logged-in token is used automatically, so
 * there is no copy-pasting. `quikrun mcp print [client]` shows the config without writing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import pc from "picocolors";
import prompts from "prompts";
import { readToken } from "../config.js";
import { CMD } from "../util.js";

const MCP_URL = process.env.QUIKRUN_MCP_URL ?? "https://mcp.quik.run";

const CLIENTS = ["claude", "cursor", "vscode", "windsurf", "zed"] as const;
type Client = (typeof CLIENTS)[number];

const LABEL: Record<Client, string> = {
  claude: "Claude Code",
  cursor: "Cursor",
  vscode: "VS Code",
  windsurf: "Windsurf",
  zed: "Zed",
};

/** Map user input (with aliases) to a known client key. */
function normalizeClient(input: string): Client | undefined {
  const key = input.toLowerCase().replace(/[\s_-]/g, "");
  const aliases: Record<string, Client> = {
    claude: "claude",
    claudecode: "claude",
    cursor: "cursor",
    vscode: "vscode",
    code: "vscode",
    windsurf: "windsurf",
    codeium: "windsurf",
    zed: "zed",
  };
  return aliases[key];
}

const authHeader = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

/** The server object each client expects under its servers map. */
function serverFor(client: Client, token: string): Record<string, unknown> {
  switch (client) {
    case "windsurf":
      return { serverUrl: MCP_URL, headers: authHeader(token) };
    case "zed":
      return { source: "custom", url: MCP_URL, headers: authHeader(token) };
    default:
      return { url: MCP_URL, headers: authHeader(token) };
  }
}

/** Resolve the token or exit with a friendly nudge to sign in. */
function requireToken(): string {
  const token = readToken();
  if (!token) {
    console.error(pc.red("✖ You are not signed in."));
    console.error(`\nSign in first, then run this again:\n`);
    console.error(pc.cyan(`  ${CMD} login\n`));
    process.exit(1);
  }
  return token;
}

/** Prompt for a client when none was passed. Returns undefined if cancelled. */
async function pickClient(): Promise<Client | undefined> {
  const { client } = await prompts({
    type: "select",
    name: "client",
    message: "Which client do you want to connect?",
    choices: CLIENTS.map((c) => ({ title: LABEL[c], value: c })),
  });
  return client as Client | undefined;
}

/** Resolve the client from an arg (validating) or an interactive prompt. */
async function resolveClient(clientArg?: string): Promise<Client | undefined> {
  if (!clientArg) return pickClient();
  const client = normalizeClient(clientArg);
  if (!client) {
    console.error(pc.red(`✖ Unknown client "${clientArg}". Choose one of: ${CLIENTS.join(", ")}.`));
    process.exit(1);
  }
  return client;
}

export async function mcpInstall(clientArg?: string): Promise<void> {
  const token = requireToken();
  const client = await resolveClient(clientArg);
  if (!client) return; // prompt cancelled

  switch (client) {
    case "claude":
      return viaCli(
        "claude",
        ["mcp", "add", "--transport", "http", "quikrun", MCP_URL, "--header", `Authorization: Bearer ${token}`],
        client,
        claudeCommand(token),
      );
    case "vscode":
      return viaCli(
        "code",
        ["--add-mcp", JSON.stringify({ name: "quikrun", url: MCP_URL, headers: authHeader(token) })],
        client,
        vscodeCommand(token),
      );
    case "cursor":
      return mergeJson(join(homedir(), ".cursor", "mcp.json"), "mcpServers", client, token);
    case "windsurf":
      return mergeJson(join(homedir(), ".codeium", "windsurf", "mcp_config.json"), "mcpServers", client, token);
    case "zed":
      return mergeJson(join(homedir(), ".config", "zed", "settings.json"), "context_servers", client, token);
  }
}

/** Run a client's own CLI; if it isn't on PATH, print the command to run by hand. */
function viaCli(bin: string, args: string[], client: Client, manual: string): void {
  const r = spawnSync(bin, args, { stdio: "inherit" });
  if (r.error) {
    const code = (r.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.log(pc.yellow(`\nThe ${bin} CLI isn't on your PATH. Add QuikRun manually:\n`));
      console.log(pc.cyan(`  ${manual}\n`));
      return;
    }
    throw r.error;
  }
  if (r.status === 0) {
    console.log(pc.green(`\n✔ Connected QuikRun to ${LABEL[client]}. Restart it if it's open.`));
  }
}

/** Merge the QuikRun server into a client's JSON config, preserving existing entries. */
function mergeJson(file: string, key: string, client: Client, token: string): void {
  const server = serverFor(client, token);
  let config: Record<string, unknown> = {};

  if (existsSync(file)) {
    try {
      config = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    } catch {
      // Some clients (e.g. Zed) use JSONC with comments — don't risk clobbering it.
      console.log(pc.yellow(`\nCouldn't parse ${file} automatically (it may contain comments).`));
      console.log(`Add this under "${key}":\n`);
      console.log(pc.cyan(`  "quikrun": ${JSON.stringify(server, null, 2).replace(/\n/g, "\n  ")}\n`));
      return;
    }
  } else {
    mkdirSync(dirname(file), { recursive: true });
  }

  const bucket = (config[key] as Record<string, unknown> | undefined) ?? {};
  bucket.quikrun = server;
  config[key] = bucket;
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);

  console.log(pc.green(`\n✔ Added QuikRun to ${LABEL[client]}.`));
  console.log(pc.dim(`  ${file}`));
  console.log(pc.dim(`  Restart ${LABEL[client]} to pick it up.`));
}

// --- `mcp print` ----------------------------------------------------------

function claudeCommand(token: string): string {
  return `claude mcp add --transport http quikrun ${MCP_URL} --header "Authorization: Bearer ${token}"`;
}
function vscodeCommand(token: string): string {
  return `code --add-mcp '${JSON.stringify({ name: "quikrun", url: MCP_URL, headers: authHeader(token) })}'`;
}

export async function mcpPrint(clientArg?: string): Promise<void> {
  const token = readToken() ?? "quik_...";
  const client = await resolveClient(clientArg);
  if (!client) return;

  console.log("");
  if (client === "claude") {
    console.log(pc.cyan(`  ${claudeCommand(token)}`));
  } else if (client === "vscode") {
    console.log(pc.cyan(`  ${vscodeCommand(token)}`));
  } else {
    const key = client === "zed" ? "context_servers" : "mcpServers";
    console.log(pc.dim(`  // under "${key}"`));
    console.log(pc.cyan(`  "quikrun": ${JSON.stringify(serverFor(client, token), null, 2).replace(/\n/g, "\n  ")}`));
  }
  console.log("");
  if (token === "quik_...") console.log(pc.dim(`  Replace quik_... with a token — ${CMD} login, or mint one at ${"https://quik.run"} → Tokens.\n`));
}
