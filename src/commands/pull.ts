/**
 * `quikrun pull` — fetch the snippet's current server-side code and overwrite
 * the local source file with it.
 */

import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import pc from "picocolors";
import { apiRequest, type SnippetDetail } from "../api.js";
import { readProjectConfig } from "../config.js";

export async function pull(): Promise<void> {
  const config = readProjectConfig();
  const slug = encodeURIComponent(config.slug);

  const detail = await apiRequest<SnippetDetail>(`/api/snippets/${slug}`);
  const remote = Array.isArray(detail.code) ? detail.code.join("\n") : "";
  const nextContent = remote.endsWith("\n") ? remote : `${remote}\n`;

  const filePath = join(process.cwd(), config.file);
  const previous = existsSync(filePath) ? readFileSync(filePath, "utf8") : null;

  writeFileSync(filePath, nextContent);

  if (previous === null) {
    console.log(pc.green(`✔ Wrote ${config.file} (${countLines(remote)} lines).`));
  } else if (previous === nextContent) {
    console.log(pc.dim(`Already up to date. ${config.file} unchanged.`));
  } else {
    const before = countLines(previous.replace(/\n$/, ""));
    const after = countLines(remote);
    console.log(
      pc.green(`✔ Updated ${config.file} (${before} → ${after} lines).`),
    );
  }
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}
