#!/usr/bin/env node
/**
 * QuikRun CLI entrypoint.
 *
 * A thin client over the QuikRun REST API. Wires up commander subcommands to
 * the handlers in ./commands. Any handler that throws (or an API error) is
 * caught here and rendered as a single red line before exiting non-zero.
 */

import { Command } from "commander";
import pc from "picocolors";
import { login } from "./commands/login.js";
import { newSnippet, type NewOptions } from "./commands/new.js";
import { deploy } from "./commands/deploy.js";
import { pull } from "./commands/pull.js";
import { run, type RunOptions } from "./commands/run.js";
import { list } from "./commands/list.js";
import { logs } from "./commands/logs.js";
import { mcpInstall, mcpPrint } from "./commands/mcp.js";
import { upgrade } from "./commands/upgrade.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("quikrun")
  .description("Scaffold, deploy, and run QuikRun snippets from your terminal.")
  .version(VERSION);

program
  .command("login")
  .description("Sign in with your browser (or pass a token to sign in headless).")
  .argument("[token]", "optional quik_… API token")
  .action((token?: string) => run_(() => login(token)));

program
  .command("new")
  .description("Scaffold a new snippet into a local directory.")
  .argument("[name]", "snippet name")
  .option("--language <lang>", "javascript | typescript | python")
  .option("--yes", "skip prompts and use defaults", false)
  .action((name: string | undefined, options: NewOptions) =>
    run_(() => newSnippet(name, options)),
  );

program
  .command("deploy")
  .description("Save the local source and deploy the snippet live.")
  .action(() => run_(() => deploy()));

program
  .command("pull")
  .description("Overwrite the local source with the deployed version.")
  .action(() => run_(() => pull()));

program
  .command("run")
  .description("Execute the local source with an optional test payload.")
  .option("--body <json>", "JSON request body")
  .option("--method <m>", "HTTP method (default GET)")
  .action((options: RunOptions) => run_(() => run(options)));

program
  .command("list")
  .description("List all snippets in your team.")
  .action(() => run_(() => list()));

program
  .command("logs")
  .description("Show recent run/deploy events for your team.")
  .action(() => run_(() => logs()));

const mcp = program
  .command("mcp")
  .description("Connect the QuikRun MCP server to your AI client (Claude, Cursor, VS Code, Windsurf, Zed).");

mcp
  .command("install")
  .description("Add the QuikRun MCP server to a client, using your logged-in token.")
  .argument("[client]", "claude | cursor | vscode | windsurf | zed")
  .action((client?: string) => run_(() => mcpInstall(client)));

mcp
  .command("print")
  .description("Print a client's MCP config without writing anything.")
  .argument("[client]", "claude | cursor | vscode | windsurf | zed")
  .action((client?: string) => run_(() => mcpPrint(client)));

program
  .command("upgrade")
  .alias("update")
  .description("Update the CLI to the latest published version.")
  .action(() => run_(() => upgrade()));

/**
 * Run an async command handler and convert any thrown error into a clean,
 * single-line red message + non-zero exit. API-layer failures already exit
 * on their own; this catches local errors (missing quikrun.json, bad JSON…).
 */
async function run_(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`✖ ${message}`));
    process.exit(1);
  }
}

program.parseAsync(process.argv);
