/**
 * `quikrun logs` — fetch the (team-wide) dashboard payload and pretty-print
 * its `events` array if present, otherwise dump the raw JSON.
 */

import pc from "picocolors";
import { apiRequest } from "../api.js";

/** Loosely-typed dashboard payload — the shape is server-driven. */
interface LogsResponse {
  rows?: LogEvent[];
  [key: string]: unknown;
}

interface LogEvent {
  level?: string;
  snippet?: string;
  message?: string;
  time?: string;
  [key: string]: unknown;
}

export async function logs(): Promise<void> {
  const data = await apiRequest<LogsResponse>("/api/logs");

  // GET /api/logs returns { ..., rows: [{ time, snippet, level, message, ... }] }.
  const events = data.rows;
  if (!Array.isArray(events)) {
    // Unexpected shape — show the payload verbatim rather than pretend it's empty.
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (events.length === 0) {
    console.log(pc.dim("No recent logs."));
    return;
  }

  for (const ev of events) {
    const when = ev.time ?? "";
    const level = ev.level ?? "";
    const who = ev.snippet ?? "";
    const what = ev.message ?? "";
    const parts = [
      when ? pc.dim(when) : "",
      level ? paintLevel(level) : "",
      who ? pc.bold(who) : "",
      what,
    ].filter(Boolean);
    console.log(parts.join("  "));
  }
}

function paintLevel(level: string): string {
  switch (level.toLowerCase()) {
    case "error":
    case "failed":
      return pc.red(level);
    case "warn":
    case "warning":
      return pc.yellow(level);
    case "live":
    case "ok":
    case "success":
      return pc.green(level);
    default:
      return pc.cyan(level);
  }
}
