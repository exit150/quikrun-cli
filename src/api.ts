/**
 * Thin, typed wrapper over the QuikRun REST API.
 *
 * Every request is authenticated with the resolved Bearer token and speaks
 * JSON. On any non-2xx response (or missing token) we print a red error and
 * exit the process, so command code can treat `api*` calls as "returns data
 * or never returns".
 */

import pc from "picocolors";
import { API_URL, readToken } from "./config.js";

/** Print a red error line and terminate the CLI with a failure code. */
export function fail(message: string): never {
  console.error(pc.red(`✖ ${message}`));
  process.exit(1);
}

/** Ensure a token exists, otherwise guide the user to `login` and exit. */
export function requireToken(): string {
  const token = readToken();
  if (!token) {
    console.error(pc.red("✖ You are not logged in."));
    console.error(
      `\nMint a token in the ${pc.bold("quik.run dashboard → Tokens")}, then run:\n`,
    );
    console.error(pc.cyan("  quikrun login <token>\n"));
    process.exit(1);
  }
  return token;
}

/** HTTP methods we actually use. */
type Method = "GET" | "POST" | "PUT" | "PATCH";

interface RequestOptions {
  method?: Method;
  /** JSON-serialisable request body. */
  body?: unknown;
  /** Override the token (used by `login` to validate before saving). */
  token?: string;
}

/**
 * Core request helper. Resolves the token, sends the request, and returns the
 * parsed JSON body typed as `T`. Non-2xx responses call `fail()` and never
 * return. A `null`/empty body parses to `{}`.
 */
export async function apiRequest<T>(
  path: string,
  { method = "GET", body, token }: RequestOptions = {},
): Promise<T> {
  const authToken = token ?? requireToken();
  const url = `${API_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return fail(`Could not reach ${API_URL} (${detail}).`);
  }

  const text = await res.text();
  if (!res.ok) {
    const detail = text.trim() || res.statusText || "no response body";
    return fail(`${method} ${path} → ${res.status} ${res.statusText}\n${detail}`);
  }

  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fail(`${method} ${path} returned invalid JSON:\n${text}`);
  }
}

// ---------------------------------------------------------------------------
// Response shapes for the endpoints the CLI touches.
// These mirror the documented REST contract; unused fields are omitted.
// ---------------------------------------------------------------------------

export interface SnippetListItem {
  name: string;
  slug: string;
  lang?: string;
  visibility?: string;
  endpoint?: string;
  // The list route returns runs as a locale-formatted string (num()), e.g. "1,204".
  runs?: string;
  lastRun?: string | null;
}

export interface SnippetListResponse {
  snippets: SnippetListItem[];
}

export interface CreateSnippetResponse {
  slug: string;
  name: string;
}

export interface SnippetDetail {
  snippet: {
    name: string;
    visibility?: "private" | "public";
    url?: string;
    status?: string;
    diff?: unknown;
    language: string;
    runtime: string;
  };
  file?: { name: string; lang?: string; lines?: number };
  code: string[];
  versions?: unknown;
}

export interface SaveCodeResponse {
  ok?: boolean;
  diff?: unknown;
  savedAt?: string;
  lines?: number;
}

export interface DeployResponse {
  status: string;
  url: string;
  version?: { label?: string; badge?: string };
}

export interface RunResponse {
  status?: string;
  // The run route pre-formats these as strings: status "200", ms "12ms"/"<1ms", size "1.2 KB".
  response?: { status?: string; statusText?: string; ms?: string; size?: string };
  json?: string[];
  logLines?: { level: string; text: string }[];
  // error is the execution error object (or null), not a string.
  error?: { name?: string; message?: string; stack?: string } | null;
}
