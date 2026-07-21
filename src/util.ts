/**
 * Small, dependency-free helpers shared across commands:
 * slug generation, language <-> file-extension mapping, and token masking.
 */

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
/** How the CLI was invoked, so messages suggest the matching command. Running via npx executes
 * from an "_npx" cache directory; a global/local install runs from a node_modules bin path. */
export const CMD = (process.argv[1] ?? "").includes("_npx") ? "npx quikrun" : "quikrun";

export function maskToken(token: string): string {
  if (token.length <= 12) return `${token.slice(0, 4)}…`;
  return `${token.slice(0, 9)}…${token.slice(-4)}`;
}
