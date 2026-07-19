/**
 * Configuration + local-file I/O.
 *
 * Two distinct pieces of state live here:
 *   1. The auth token — global, stored in `~/.quikrun/config.json` (mode 0600),
 *      overridable by the `QUIKRUN_TOKEN` env var (env always wins).
 *   2. The per-project `quikrun.json` — describes a single scaffolded snippet
 *      and lives in the working directory the user runs commands from.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import type { Language } from "./util.js";

/** Base URL of the QuikRun REST API. Overridable for local/staging testing. */
export const API_URL = process.env.QUIKRUN_API_URL ?? "https://api.quik.run";

const CONFIG_DIR = join(homedir(), ".quikrun");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

/** Shape of the global auth config file. */
interface GlobalConfig {
  token?: string;
}

/**
 * Resolve the active token. Precedence: `QUIKRUN_TOKEN` env var, then the
 * saved config file. Returns `undefined` when the user is not authenticated.
 */
export function readToken(): string | undefined {
  const fromEnv = process.env.QUIKRUN_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  if (!existsSync(CONFIG_FILE)) return undefined;
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as GlobalConfig;
    return parsed.token?.trim() || undefined;
  } catch {
    // Corrupt/unreadable config should behave like "not logged in" rather
    // than crash every command.
    return undefined;
  }
}

/**
 * Persist the token to `~/.quikrun/config.json`, creating the directory with
 * restrictive permissions (0700 dir, 0600 file) so the secret is not world
 * readable on shared machines.
 */
export function writeToken(token: string): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  const body = JSON.stringify({ token } satisfies GlobalConfig, null, 2);
  writeFileSync(CONFIG_FILE, `${body}\n`, { mode: 0o600 });
  // writeFileSync only applies `mode` when creating the file, so re-assert it
  // for the case where the file already existed with looser permissions.
  chmodSync(CONFIG_FILE, 0o600);
}

/** Absolute path of the config file, for messaging to the user. */
export const configPath = CONFIG_FILE;

// ---------------------------------------------------------------------------
// Per-project quikrun.json
// ---------------------------------------------------------------------------

const PROJECT_FILE = "quikrun.json";

/** Per-project descriptor written by `new` and read by `deploy`/`pull`/`run`. */
export interface ProjectConfig {
  slug: string;
  language: Language | string;
  runtime: string;
  visibility: "private" | "public";
  /** Local source filename relative to the project directory, e.g. "snippet.js". */
  file: string;
}

/**
 * Read `quikrun.json` from `dir` (default: cwd). Throws a friendly error if it
 * is missing so callers can surface "run this inside a snippet directory".
 */
export function readProjectConfig(dir: string = process.cwd()): ProjectConfig {
  const path = join(dir, PROJECT_FILE);
  if (!existsSync(path)) {
    throw new Error(
      `No ${PROJECT_FILE} found in this directory. Run \`quikrun new\` to scaffold a snippet, or \`cd\` into an existing one.`,
    );
  }
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ProjectConfig;
}

/** Write `quikrun.json` into `dir` with pretty formatting. */
export function writeProjectConfig(config: ProjectConfig, dir: string): void {
  const path = join(dir, PROJECT_FILE);
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}
