// The running CLI version, read from package.json at runtime so `--version` and the upgrade
// check never drift from what was published. Works in dev (tsx) and from dist/.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export const VERSION: string = pkg.version;

/** Parse a semver string into its numeric core and prerelease identifiers, ignoring build metadata. */
function parse(v: string): { core: number[]; pre: Array<string | number> } {
  const main = v.trim().split("+", 1)[0] ?? ""; // drop +build metadata
  const dash = main.indexOf("-");
  const core = (dash === -1 ? main : main.slice(0, dash)).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pre =
    dash === -1
      ? []
      : main
          .slice(dash + 1)
          .split(".")
          .map((id) => (/^\d+$/.test(id) ? Number.parseInt(id, 10) : id));
  return { core, pre };
}

/** True if version `a` is strictly older than `b`, following semver precedence (prerelease < release). */
export function versionLt(a: string, b: string): boolean {
  const pa = parse(a);
  const pb = parse(b);

  for (let i = 0; i < 3; i++) {
    const x = pa.core[i] ?? 0;
    const y = pb.core[i] ?? 0;
    if (x !== y) return x < y;
  }

  // Cores equal: a version WITH a prerelease is lower than one without (1.0.0-rc < 1.0.0).
  if (pa.pre.length === 0 || pb.pre.length === 0) return pa.pre.length > pb.pre.length;

  // Both prerelease: compare identifiers left to right (semver §11).
  const n = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < n; i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return true; // fewer identifiers sorts lower
    if (y === undefined) return false;
    if (x === y) continue;
    const xNum = typeof x === "number";
    const yNum = typeof y === "number";
    if (xNum && yNum) return (x as number) < (y as number);
    if (xNum !== yNum) return xNum; // numeric identifiers sort lower than alphanumeric
    return String(x) < String(y);
  }
  return false;
}
