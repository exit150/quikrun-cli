/**
 * `quikrun login <token>` — validate a token against the API and, if it works,
 * persist it to `~/.quikrun/config.json`.
 */

import pc from "picocolors";
import { apiRequest, type SnippetListResponse } from "../api.js";
import { writeToken, configPath } from "../config.js";
import { maskToken } from "../util.js";

export async function login(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    console.error(pc.red("✖ A token is required: quikrun login <token>"));
    process.exit(1);
  }

  // Validate by hitting an authenticated read endpoint. A 200 means the token
  // is accepted; any non-2xx makes apiRequest print + exit for us.
  await apiRequest<SnippetListResponse>("/api/snippets", { token: trimmed });

  writeToken(trimmed);

  console.log(pc.green(`✔ Logged in as ${pc.bold(maskToken(trimmed))}`));
  console.log(pc.dim(`  Token saved to ${configPath}`));
}
