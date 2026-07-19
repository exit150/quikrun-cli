/**
 * `quikrun list` — print a table of the team's snippets.
 */

import pc from "picocolors";
import { apiRequest, type SnippetListResponse } from "../api.js";

export async function list(): Promise<void> {
  const data = await apiRequest<SnippetListResponse>("/api/snippets");
  const snippets = data.snippets ?? [];

  if (snippets.length === 0) {
    console.log(pc.dim("No snippets yet. Create one with `quikrun new`."));
    return;
  }

  // Build rows, then compute per-column widths for a clean aligned table.
  const header = ["NAME", "SLUG", "VISIBILITY", "RUNS", "LAST RUN"];
  const rows = snippets.map((s) => [
    s.name ?? "",
    s.slug ?? "",
    s.visibility ?? "",
    s.runs !== undefined ? String(s.runs) : "0",
    s.lastRun ? String(s.lastRun) : "—",
  ]);

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const pad = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join("  ");

  console.log(pc.bold(pad(header)));
  for (const row of rows) console.log(pad(row));
}
