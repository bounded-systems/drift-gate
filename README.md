# drift-gate

**A surface- and descriptor-drift gate for TypeScript/JavaScript repos — a
library, a CLI, and a single self-contained binary.** It answers one question in
CI or locally: *has a package's public contract drifted from what's recorded?*

Two checks:

- **surface** (general — any TS/JS repo): a module's exported symbols
  (name · kind · structural signature), extracted with the TypeScript compiler
  and diffed against a checked-in **golden**. Adding, removing, or
  signature-changing an export is drift. Interfaces and classes expand their
  public members, so adding a field *is* caught.
- **descriptor** (opt-in — the bounded-systems convention): a repo's
  `trellis.json` `descriptor.proof.claims[]` verified against the git-blob-hash
  pins in its generated README claims table. Repos without the convention are
  **skipped**, never failed — so `drift` is useful on any codebase.

The golden is the pin: an intentional API change is acknowledged by regenerating
it and committing the reviewable diff.

## Install / run

Runs three ways — as a Deno CLI, a compiled binary (no runtime needed), or a
library:

```sh
# 1. Deno CLI
deno run -A jsr:@bounded-systems/drift-gate/cli surface --entry ./mod.ts

# 2. Standalone binary (from a GitHub release; no Deno/Node required)
drift check --entry ./mod.ts --golden .drift/surface.json

# 3. Library
# import { extractSurface, checkSurface, runGate } from "@bounded-systems/drift-gate";
```

## CLI

```
drift surface    --entry ./mod.ts                          # print a module's surface as JSON
drift update     --entry ./mod.ts --golden .drift/surface.json   # (re)write the golden
drift check      --entry ./mod.ts --golden .drift/surface.json   # exit 1 on surface drift
drift check      --entry ./mod.ts --golden .drift/surface.json --fix   # accept the drift (regenerate the golden)
drift descriptor --root .                                   # proof-claim honesty (skipped if N/A)
drift gate       --root . --entry mod.ts --golden .drift/surface.json [--fix]   # every applicable check
```

`check` / `gate` exit non-zero on drift, so they drop straight into CI. Add
**`--fix`** to *analyze → report → remediate* in one step (eslint-style): the
drift is printed, then the golden is regenerated to accept the new surface (exit
0). `--fix` only auto-accepts **surface** drift; **descriptor** drift (stale
README pins) is reported, not silently rewritten — it needs re-pinning at the
source. The verb registry is defined with
[verbspec](https://jsr.io/@bounded-systems/verbspec), so the same commands project
to MCP / OpenAPI for free.

## Reproducibility

The surface projection is a pure function of the module and the pinned toolchain
(ts-morph → TypeScript). Commit `deno.lock` so CI resolves the same versions; a
toolchain bump is a reviewed golden regeneration. External types render as `any`
if the target repo's dependencies aren't installed — run `drift` where deps exist.

## Where this sits

drift-gate is one seam of [bounded-systems](https://github.com/bounded-systems):
[`conformance`](https://github.com/bounded-systems/conformance) and
[`trellis`](https://github.com/bounded-systems/trellis) consume it to enforce
"the contract can't rot" across the org, and it stands alone against any external
codebase.

## License

[PolyForm Noncommercial License 1.0.0](LICENSE).
