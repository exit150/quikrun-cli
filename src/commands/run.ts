/**
 * `quikrun run [--body <json>] [--method <m>]` — execute the local source
 * against the snippet's run endpoint and print the result + logs.
 */

import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import pc from "picocolors";
import { apiRequest, fail, type RunResponse } from "../api.js";
import { readProjectConfig } from "../config.js";

export interface RunOptions {
  /** Raw JSON string to send as the request body. */
  body?: string;
  /** HTTP method to simulate (default GET). */
  method?: string;
}

export async function run(options: RunOptions): Promise<void> {
  const config = readProjectConfig();
  const filePath = join(process.cwd(), config.file);
  if (!existsSync(filePath)) {
    fail(`Source file "${config.file}" is missing.`);
  }

  const source = readFileSync(filePath, "utf8");
  // The run route validates `code: v.optional(v.string())` — send a plain string.
  const code = source.replace(/\n$/, "");
  const method = (options.method ?? "GET").toUpperCase();

  // Validate the body up front so bad JSON fails fast — but send the RAW string:
  // the run route expects `body` as a string and parses it server-side per bodyType.
  let bodyType: "JSON" | "None" = "None";
  if (options.body !== undefined) {
    try {
      JSON.parse(options.body);
    } catch {
      fail(`--body is not valid JSON: ${options.body}`);
    }
    bodyType = "JSON";
  }

  const slug = encodeURIComponent(config.slug);
  console.log(pc.dim(`Running ${config.slug} [${method}]…`));

  const result = await apiRequest<RunResponse>(`/api/snippets/${slug}/run`, {
    method: "POST",
    body: { code, method, body: options.body, bodyType },
  });

  // --- Status ----------------------------------------------------------
  // response.status is a string like "200"; coerce for the ok range check.
  const httpStatus = result.response?.status;
  const httpCode = httpStatus !== undefined ? Number(httpStatus) : NaN;
  const ok = Number.isFinite(httpCode) ? httpCode >= 200 && httpCode < 400 : result.status === "ok";
  const statusLabel = result.status ?? (ok ? "ok" : "error");
  const painted = ok ? pc.green(statusLabel) : pc.red(statusLabel);
  // response.ms already includes its unit ("12ms" / "<1ms") — don't append another.
  const timing = result.response?.ms ? pc.dim(` ${result.response.ms}`) : "";
  const httpLabel =
    httpStatus !== undefined
      ? ` ${httpStatus}${result.response?.statusText ? ` ${result.response.statusText}` : ""}`
      : "";
  console.log(`\n${pc.bold("status")}  ${painted}${pc.dim(httpLabel)}${timing}`);

  // --- Output ----------------------------------------------------------
  if (result.json && result.json.length > 0) {
    console.log(pc.bold("\noutput"));
    for (const line of result.json) console.log(`  ${line}`);
  }

  // --- Logs ------------------------------------------------------------
  if (result.logLines && result.logLines.length > 0) {
    console.log(pc.bold("\nlogs"));
    for (const log of result.logLines) console.log(`  ${paintLog(log.level)} ${log.text}`);
  }

  // --- Error -----------------------------------------------------------
  // error is an object { name, message, stack } | null — surface the message.
  if (result.error) {
    const { name, message } = result.error;
    const label = [name, message].filter(Boolean).join(": ") || "execution failed";
    console.log(pc.red(`\nerror: ${label}`));
    process.exit(1);
  }
  console.log();
}

/** Colour a log level tag for readability. */
function paintLog(level: string): string {
  const tag = `[${level}]`;
  switch (level.toLowerCase()) {
    case "error":
      return pc.red(tag);
    case "warn":
    case "warning":
      return pc.yellow(tag);
    case "info":
      return pc.cyan(tag);
    default:
      return pc.dim(tag);
  }
}
