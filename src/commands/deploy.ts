/**
 * `quikrun deploy` — save the local source to the snippet's latest version,
 * then deploy it live.
 */

import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import pc from "picocolors";
import {
  apiRequest,
  fail,
  type DeployResponse,
  type SaveCodeResponse,
} from "../api.js";
import { readProjectConfig } from "../config.js";

export async function deploy(): Promise<void> {
  const config = readProjectConfig();
  const filePath = join(process.cwd(), config.file);
  if (!existsSync(filePath)) {
    fail(`Source file "${config.file}" is missing. Did it get moved or deleted?`);
  }

  const source = readFileSync(filePath, "utf8");
  // The save route validates `code: v.string()` — send the raw source, not an array
  // of lines (GET *returns* lines, but the write side accepts a plain string).
  const code = source.replace(/\n$/, "");
  const lineCount = code.split("\n").length;

  const slug = encodeURIComponent(config.slug);

  console.log(pc.dim(`Saving ${config.file} (${lineCount} lines)…`));
  const saved = await apiRequest<SaveCodeResponse>(`/api/snippets/${slug}/code`, {
    method: "PUT",
    body: { code, language: config.language },
  });
  if (saved.savedAt) console.log(pc.dim(`  saved at ${saved.savedAt}`));

  console.log(pc.dim("Deploying…"));
  const result = await apiRequest<DeployResponse>(`/api/snippets/${slug}/deploy`, {
    method: "POST",
  });

  const label = result.version?.label ? ` (${result.version.label})` : "";
  console.log(pc.green(`\n✔ Deployed${label}`));
  console.log(`  ${pc.dim("status")} ${result.status}`);
  if (result.url) console.log(`  ${pc.dim("live")}   ${pc.cyan(result.url)}`);
  console.log();
}
