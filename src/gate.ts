// High-level checks composed from the engine primitives.
import { diffSurface, extractSurface } from "./surface.ts";
import { readGolden } from "./golden.ts";
import { checkDescriptor } from "./descriptor.ts";
import type { CheckResult } from "./types.ts";

/** Diff a module's live surface against its checked-in golden. */
export async function checkSurface(
  entryPath: string,
  goldenPath: string,
): Promise<CheckResult> {
  const golden = await readGolden(goldenPath);
  const live = extractSurface(entryPath);
  const failures = diffSurface(golden.symbols, live.symbols);
  const notes = [
    `golden: ${golden.symbols.length} symbols; live: ${live.symbols.length} symbols`,
  ];
  if (failures.length) {
    notes.push(
      "Intentional API change? Regenerate the golden (`drift surface:update`) and commit the diff.",
    );
  }
  return { name: "surface", ok: failures.length === 0, failures, notes };
}

export interface GateOptions {
  root: string;
  /** Module entry to surface-check (relative to root). Omit to skip surface. */
  entry?: string;
  /** Golden path (relative to root or absolute). Required for the surface check. */
  golden?: string;
  trellis?: string;
  readme?: string;
}

/** Run every applicable check for a repo: descriptor (if it's a descriptor repo) + surface (if an entry+golden are given). */
export async function runGate(opts: GateOptions): Promise<CheckResult[]> {
  const root = opts.root.replace(/\/+$/, "");
  const results: CheckResult[] = [];
  results.push(
    await checkDescriptor({ root, trellis: opts.trellis, readme: opts.readme }),
  );
  if (opts.entry && opts.golden) {
    const goldenPath = opts.golden.startsWith("/")
      ? opts.golden
      : `${root}/${opts.golden}`;
    results.push(await checkSurface(`${root}/${opts.entry}`, goldenPath));
  }
  return results;
}
