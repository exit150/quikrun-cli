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

const program = new Command();

program
  .name("quikrun")
  .description("Scaffold, deploy, and run QuikRun snippets from your terminal.")
  .version("0.1.0");

program
  .command("login")
  .description("Save and validate an API token (mint one in quik.run → Tokens).")
  .argument("<token>", "your quik_… API token")
  .action((token: string) => run_(() => login(token)));

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
