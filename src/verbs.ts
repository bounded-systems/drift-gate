// The drift-gate verb surface. Each verb is a pure projection of one VerbSpec —
// CLI now (via `dispatch` in cli.ts), MCP / OpenAPI / OpenRPC for free. Verbs are
// thin wrappers over the engine in this directory.
import { z } from "zod";
import { defineVerb, type Registry } from "verbspec";
import { extractSurface } from "./surface.ts";
import { writeGolden } from "./golden.ts";
import { checkSurface, runGate } from "./gate.ts";
import { checkDescriptor } from "./descriptor.ts";

const SymbolSchema = z.object({
  name: z.string(),
  kind: z.string(),
  signature: z.string(),
});

const surfaceVerb = defineVerb({
  id: "surface",
  summary: "Extract a module's exported surface (name/kind/signature) as JSON.",
  actor: "drift-gate",
  input: z.object({ entry: z.string() }),
  output: z.object({
    module: z.string(),
    count: z.number(),
    symbols: z.array(SymbolSchema),
  }),
  run: ({ entry }: { entry: string }) => {
    const s = extractSurface(entry);
    return { module: s.module, count: s.symbols.length, symbols: s.symbols };
  },
});

const checkVerb = defineVerb({
  id: "check",
  summary:
    "Diff a module's surface against a golden. ok=false (exit 1) on drift; --fix regenerates the golden to accept it.",
  actor: "drift-gate",
  input: z.object({
    entry: z.string(),
    golden: z.string(),
    fix: z.boolean().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    fixed: z.boolean(),
    failures: z.array(z.string()),
    notes: z.array(z.string()),
  }),
  run: async (
    { entry, golden, fix }: { entry: string; golden: string; fix?: boolean },
  ) => {
    const r = await checkSurface(entry, golden);
    if (!r.ok && fix) {
      const g = await writeGolden(golden, entry);
      return {
        ok: true,
        fixed: true,
        failures: r.failures,
        notes: [
          `--fix: regenerated ${golden} (${g.symbols.length} symbols) to accept the drift above`,
          ...r.notes,
        ],
      };
    }
    return { ok: r.ok, fixed: false, failures: r.failures, notes: r.notes };
  },
});

const updateVerb = defineVerb({
  id: "update",
  summary:
    "Regenerate a surface golden from a module (the reviewed way to accept an API change).",
  actor: "drift-gate",
  input: z.object({
    entry: z.string(),
    golden: z.string(),
    rev: z.string().optional(),
  }),
  output: z.object({ written: z.string(), count: z.number() }),
  run: async (
    { entry, golden, rev }: { entry: string; golden: string; rev?: string },
  ) => {
    const g = await writeGolden(golden, entry, rev);
    return { written: golden, count: g.symbols.length };
  },
});

const descriptorVerb = defineVerb({
  id: "descriptor",
  summary:
    "Verify a repo's trellis.json proof claims against its README pins (skipped if not a descriptor repo).",
  actor: "drift-gate",
  input: z.object({
    root: z.string(),
    trellis: z.string().optional(),
    readme: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    skipped: z.boolean(),
    failures: z.array(z.string()),
    notes: z.array(z.string()),
  }),
  run: async (i: { root: string; trellis?: string; readme?: string }) => {
    const r = await checkDescriptor(i);
    return {
      ok: r.ok,
      skipped: Boolean(r.skipped),
      failures: r.failures,
      notes: r.notes,
    };
  },
});

const gateVerb = defineVerb({
  id: "gate",
  summary:
    "Run every applicable check for a repo (descriptor + surface). ok=false (exit 1) on any drift; --fix regenerates the surface golden.",
  actor: "drift-gate",
  input: z.object({
    root: z.string(),
    entry: z.string().optional(),
    golden: z.string().optional(),
    trellis: z.string().optional(),
    readme: z.string().optional(),
    fix: z.boolean().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    fixed: z.boolean(),
    checks: z.array(z.object({
      name: z.string(),
      ok: z.boolean(),
      skipped: z.boolean(),
      failures: z.array(z.string()),
      notes: z.array(z.string()),
    })),
  }),
  run: async (
    i: {
      root: string;
      entry?: string;
      golden?: string;
      trellis?: string;
      readme?: string;
      fix?: boolean;
    },
  ) => {
    const { fix, ...opts } = i;
    const root = opts.root.replace(/\/+$/, "");
    let rs = await runGate(opts);
    let fixed = false;

    // --fix only auto-accepts SURFACE drift (regenerate the golden). Descriptor
    // drift (stale README pins) needs re-pinning by descriptor-kit and is left
    // as a failure with a note, not silently rewritten.
    if (fix && opts.entry && opts.golden) {
      const surface = rs.find((r) => r.name === "surface");
      if (surface && !surface.ok) {
        const goldenPath = opts.golden.startsWith("/")
          ? opts.golden
          : `${root}/${opts.golden}`;
        await writeGolden(goldenPath, `${root}/${opts.entry}`);
        fixed = true;
        rs = await runGate(opts); // re-check so the report reflects the fix
      }
    }

    return {
      ok: rs.every((r) => r.ok),
      fixed,
      checks: rs.map((r) => ({
        name: r.name,
        ok: r.ok,
        skipped: Boolean(r.skipped),
        failures: r.failures,
        notes: r.notes,
      })),
    };
  },
});

/** The drift-gate verb registry. */
export const VERBS: Registry = {
  surface: surfaceVerb,
  check: checkVerb,
  update: updateVerb,
  descriptor: descriptorVerb,
  gate: gateVerb,
};
