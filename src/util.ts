/**
 * Small, dependency-free helpers shared across commands:
 * slug generation, language <-> file-extension mapping, and token masking.
 */

import { resolve, sep } from "node:path";

/** Supported snippet languages. Keep this the single source of truth. */
export type Language = "javascript" | "typescript" | "python";

export const LANGUAGES: readonly Language[] = ["javascript", "typescript", "python"];

/** Map a language to the file extension used for its local source file. */
const EXT_BY_LANGUAGE: Record<Language, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
};

/**
 * Return the source-file extension for a language, defaulting to "txt" for
 * anything we do not explicitly know about (keeps `new`/`deploy` resilient
 * to server-side language values we have not modelled yet).
 */
export function extForLanguage(language: string): string {
  return EXT_BY_LANGUAGE[language as Language] ?? "txt";
}

/** Narrow an arbitrary string to a known Language, if possible. */
export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Convert an arbitrary name into a filesystem/URL-safe slug:
 * lowercase, alphanumerics and dashes only, collapsed and trimmed.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Mask a secret token for display, e.g. `quik_abcd1234...wxyz` becomes
 * `quik_abcd…wxyz`. Short tokens are only partially revealed.
 */
const ARGV1 = resolve(process.argv[1] ?? "");
const USER_AGENT = process.env.npm_config_user_agent ?? "";

/** The package manager running this process, inferred from npm's user-agent (set by npx/dlx/run). */
export type PkgManager = "npm" | "pnpm" | "yarn" | "bun";
export const PKG_MANAGER: PkgManager = USER_AGENT.startsWith("pnpm")
  ? "pnpm"
  : USER_AGENT.startsWith("yarn")
    ? "yarn"
    : USER_AGENT.startsWith("bun")
      ? "bun"
      : "npm";

/** True when running a one-off via npx / pnpm dlx / bunx — nothing is installed to upgrade. */
export const IS_EPHEMERAL = /[\\/](_npx|dlx|bunx)/i.test(ARGV1);

/** True when the CLI resolves to a project-local dependency (its bin lives under the current project). */
export const IS_LOCAL = !IS_EPHEMERAL && ARGV1.startsWith(process.cwd() + sep);

/** How the CLI was invoked, so messages suggest the matching command. */
export const CMD = IS_EPHEMERAL ? "npx quikrun" : "quikrun";

export function maskToken(token: string): string {
  if (token.length <= 12) return `${token.slice(0, 4)}…`;
  return `${token.slice(0, 9)}…${token.slice(-4)}`;
}
