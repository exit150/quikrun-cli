/**
 * `quikrun upgrade` — update the CLI to the latest published version.
 *
 * How to upgrade depends on how the CLI is running:
 *   - one-off (npx / pnpm dlx / bunx): nothing is installed, so we point at `@latest`;
 *   - project dependency: we tell you to update it in your project (never a global install);
 *   - global install: we run the matching package manager's global install.
 * We check the registry first so an already-current CLI is a fast no-op.
 */

import { spawnSync } from "node:child_process";
import pc from "picocolors";
import { VERSION, versionLt } from "../version.js";
import { IS_EPHEMERAL, IS_LOCAL, PKG_MANAGER, type PkgManager } from "../util.js";

const DEFAULT_REGISTRY = "https://registry.npmjs.org";
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

// Per-manager commands. The check and the install stay consistent this way.
const GLOBAL_INSTALL: Record<PkgManager, string[]> = {
  npm: ["install", "-g", "quikrun@latest"],
  pnpm: ["add", "-g", "quikrun@latest"],
  yarn: ["global", "add", "quikrun@latest"],
  bun: ["add", "-g", "quikrun@latest"],
};
const LOCAL_INSTALL: Record<PkgManager, string[]> = {
  npm: ["install", "quikrun@latest"],
  pnpm: ["add", "quikrun@latest"],
  yarn: ["add", "quikrun@latest"],
  bun: ["add", "quikrun@latest"],
};
const RUN_LATEST: Record<PkgManager, string> = {
  npm: "npx quikrun@latest",
  pnpm: "pnpm dlx quikrun@latest",
  yarn: "yarn dlx quikrun@latest",
  bun: "bunx quikrun@latest",
};

/** A custom registry from QUIKRUN_REGISTRY, only if it's a valid http(s) URL. */
function customRegistry(): string | undefined {
  const raw = process.env.QUIKRUN_REGISTRY?.trim().replace(/\/+$/, "");
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol === "https:" || u.protocol === "http:") return raw;
  } catch {
    /* fall through */
  }
  return undefined;
}

/** Latest published version from the registry, validated as a real semver string. */
async function latestVersion(): Promise<string | undefined> {
  try {
    const base = customRegistry() ?? DEFAULT_REGISTRY;
    const res = await fetch(`${base}/quikrun/latest`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { version?: unknown };
    const v = typeof body.version === "string" ? body.version.trim() : "";
    return SEMVER.test(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

const label = (pm: PkgManager, args: string[]): string => `${pm} ${args.join(" ")}`;

export async function upgrade(): Promise<void> {
  const latest = await latestVersion();

  if (!latest) {
    console.error(pc.yellow("Couldn't reach the npm registry to check for updates."));
    console.error(pc.dim(`  Try manually:  ${label(PKG_MANAGER, GLOBAL_INSTALL[PKG_MANAGER])}`));
    process.exitCode = 1;
    return;
  }

  if (!versionLt(VERSION, latest)) {
    console.log(pc.green(`✔ You're on the latest quikrun (v${VERSION}).`));
    return;
  }

  console.log(`quikrun ${pc.dim(`v${VERSION}`)} → ${pc.bold(pc.green(`v${latest}`))}`);

  // One-off runners never install — just re-run at @latest.
  if (IS_EPHEMERAL) {
    const runner = PKG_MANAGER === "npm" ? "npx" : PKG_MANAGER;
    console.log(`\nYou're running a one-off via ${pc.bold(runner)}. Nothing to update in place — just run the latest:\n`);
    console.log(pc.cyan(`  ${RUN_LATEST[PKG_MANAGER]} <command>\n`));
    console.log(pc.dim(`  Or install it for good:  ${label(PKG_MANAGER, GLOBAL_INSTALL[PKG_MANAGER])}\n`));
    return;
  }

  // Project-local dependency — updating a global copy would leave the running one untouched.
  if (IS_LOCAL) {
    console.log(`\nThis looks like a project dependency. Update it in your project:\n`);
    console.log(pc.cyan(`  ${label(PKG_MANAGER, LOCAL_INSTALL[PKG_MANAGER])}\n`));
    return;
  }

  // Global install — run the matching manager, honoring a custom registry so the
  // installed artifact matches the one we checked.
  const reg = customRegistry();
  const args = reg && (PKG_MANAGER === "npm" || PKG_MANAGER === "pnpm")
    ? [...GLOBAL_INSTALL[PKG_MANAGER], "--registry", reg]
    : GLOBAL_INSTALL[PKG_MANAGER];

  console.log(pc.dim(`\nRunning: ${label(PKG_MANAGER, args)}\n`));
  const bin = process.platform === "win32" ? `${PKG_MANAGER}.cmd` : PKG_MANAGER;
  const r = spawnSync(bin, args, { stdio: "inherit", shell: process.platform === "win32", timeout: 120_000 });

  if (r.error || r.status !== 0) {
    console.error(pc.red("\n✖ Upgrade failed."));
    console.error(pc.dim("  Run it yourself (add sudo if it's a permissions error):"));
    console.error(pc.cyan(`    ${label(PKG_MANAGER, GLOBAL_INSTALL[PKG_MANAGER])}\n`));
    process.exitCode = 1;
    return;
  }
  console.log(pc.green(`\n✔ Upgraded to v${latest}.`));
}
