// Descriptor / proof-honesty check — the org-flavored, opt-in check. It applies
// only where a repo follows the bounded-systems convention: a trellis.json with
// `descriptor.proof.claims[]`, and a generated README claims table whose
// "Pinned at" column holds each proof file's git blob hash. Repos without that
// convention (e.g. an arbitrary external codebase) are SKIPPED, not failed.
import { gitBlobHash } from "./blob-hash.ts";
import type { CheckResult, Claim, PinRow } from "./types.ts";

async function exists(p: string): Promise<boolean> {
  try {
    await Deno.stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Read `descriptor.proof.claims[]` from a trellis.json, or null if absent/malformed. */
export async function readTrellisClaims(
  trellisPath: string,
): Promise<Claim[] | null> {
  if (!(await exists(trellisPath))) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await Deno.readTextFile(trellisPath));
  } catch {
    return null;
  }
  // deno-lint-ignore no-explicit-any
  const claims = (parsed as any)?.descriptor?.proof?.claims;
  if (!Array.isArray(claims)) return null;
  // deno-lint-ignore no-explicit-any
  return claims.map((c: any) => ({
    claim: c.claim,
    provenBy: c.provenBy,
    via: c.via,
  }));
}

function firstBacktick(cell: string): string | null {
  const m = cell.match(/`([^`]+)`/);
  return m ? m[1] : null;
}

/** Parse a generated README claims table (`<!-- descriptor:claims start/end -->`). */
export async function parseReadmeClaimsTable(
  readmePath: string,
): Promise<PinRow[] | null> {
  if (!(await exists(readmePath))) return null;
  const md = await Deno.readTextFile(readmePath);
  const start = md.indexOf("<!-- descriptor:claims start -->");
  const end = md.indexOf("<!-- descriptor:claims end -->");
  if (start === -1 || end === -1 || end < start) return null;
  const block = md.slice(start, end);
  const rows: PinRow[] = [];
  for (const line of block.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((s) => s.trim());
    if (cells.length < 5) continue;
    const provenCell = cells[2];
    const pinCell = cells[3];
    if (provenCell === "Proven by" || provenCell.startsWith("---")) continue;
    const provenBy = firstBacktick(provenCell);
    const pin = firstBacktick(pinCell);
    if (provenBy && pin) rows.push({ provenBy, pin });
  }
  return rows;
}

export interface DescriptorOptions {
  root: string;
  trellis?: string;
  readme?: string;
}

export async function checkDescriptor(
  opts: DescriptorOptions,
): Promise<CheckResult> {
  const root = opts.root.replace(/\/+$/, "");
  const trellisRel = opts.trellis ?? "trellis.json";
  const readmeRel = opts.readme ?? "README.md";

  const claims = await readTrellisClaims(`${root}/${trellisRel}`);
  if (claims === null) {
    return {
      name: "descriptor",
      ok: true,
      skipped: true,
      failures: [],
      notes: [
        `no ${trellisRel} descriptor.proof.claims — skipped (not a descriptor repo)`,
      ],
    };
  }
  const pins = await parseReadmeClaimsTable(`${root}/${readmeRel}`);
  if (pins === null) {
    return {
      name: "descriptor",
      ok: false,
      failures: [
        `trellis.json declares ${claims.length} proof claims, but no <!-- descriptor:claims --> table was found in ${readmeRel}`,
      ],
      notes: [],
    };
  }

  const failures: string[] = [];
  const pinsByPath = new Map<string, Set<string>>();
  for (const r of pins) {
    (pinsByPath.get(r.provenBy) ??
      pinsByPath.set(r.provenBy, new Set()).get(r.provenBy)!).add(r.pin);
  }
  const claimPaths = new Set(claims.map((c) => c.provenBy));

  for (const c of claims) {
    const file = `${root}/${c.provenBy}`;
    if (!(await exists(file))) {
      failures.push(
        `MISSING provenBy file: ${c.provenBy}  (claim: "${c.claim}")`,
      );
      continue;
    }
    const recorded = pinsByPath.get(c.provenBy);
    if (!recorded || recorded.size === 0) {
      failures.push(
        `NO README PIN row for provenBy: ${c.provenBy}  (claim: "${c.claim}")`,
      );
      continue;
    }
    const full = await gitBlobHash(await Deno.readFile(file));
    for (const pin of recorded) {
      if (!full.startsWith(pin)) {
        failures.push(
          `STALE PIN ${c.provenBy}: README=${pin} actual=${
            full.slice(0, pin.length)
          }`,
        );
      }
    }
  }
  for (const r of pins) {
    if (!claimPaths.has(r.provenBy)) {
      failures.push(
        `README claims table cites ${r.provenBy}, but trellis.json has no matching claim`,
      );
    }
  }

  return {
    name: "descriptor",
    ok: failures.length === 0,
    failures,
    notes: [
      `${claims.length} trellis claims checked against ${pins.length} README pin rows`,
    ],
  };
}
