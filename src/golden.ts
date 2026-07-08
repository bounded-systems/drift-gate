// The surface golden: a checked-in snapshot of a module's exported surface, plus
// provenance (the toolchain it was generated with). It is the effective pin for
// the surface check — an intentional API change is acknowledged by regenerating
// and committing the diff. Pure function of (surface, toolchain, repoRev): no
// timestamp, so regenerating with nothing changed is idempotent.
import { extractSurface, toolVersions } from "./surface.ts";
import type { SymbolEntry } from "./types.ts";

export interface Golden {
  _generated: {
    by: string;
    tsMorph: string;
    typescript: string;
    repoRev?: string;
    note: string;
  };
  module: string;
  symbols: SymbolEntry[];
}

export async function readGolden(path: string): Promise<Golden> {
  return JSON.parse(await Deno.readTextFile(path));
}

export async function writeGolden(
  path: string,
  entryPath: string,
  repoRev?: string,
): Promise<Golden> {
  const surface = extractSurface(entryPath);
  const v = toolVersions();
  const golden: Golden = {
    _generated: {
      by: "drift-gate surface:update",
      tsMorph: v.tsMorph,
      typescript: v.typescript,
      ...(repoRev ? { repoRev } : {}),
      note:
        "Regenerate on an intentional surface change; commit the diff. Pin the toolchain (typescript version) to keep the projection reproducible.",
    },
    module: surface.module,
    symbols: surface.symbols,
  };
  const dir = path.slice(0, path.lastIndexOf("/"));
  if (dir) {
    try {
      await Deno.mkdir(dir, { recursive: true });
    } catch { /* exists */ }
  }
  await Deno.writeTextFile(path, JSON.stringify(golden, null, 2) + "\n");
  return golden;
}
