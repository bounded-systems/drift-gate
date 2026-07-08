// @bounded-systems/drift-gate — a library + CLI for surface & descriptor drift.
//
// Surface drift (general, any TS/JS repo): a module's exported surface, extracted
// with the TypeScript compiler (ts-morph), diffed against a checked-in golden.
// Descriptor drift (bounded-systems convention, opt-in): a repo's trellis.json
// proof claims verified against the git-blob-hash pins in its generated README.
//
// The CLI entry is `cli.ts` (`@bounded-systems/drift-gate/cli`); the verb
// registry (VERBS) also projects to MCP/OpenAPI via verbspec.
export type {
  CheckResult,
  Claim,
  PinRow,
  Surface,
  SymbolEntry,
} from "./src/types.ts";
export {
  diffSurface,
  extractSurface,
  normalizeType,
  toolVersions,
} from "./src/surface.ts";
export { gitBlobHash } from "./src/blob-hash.ts";
export {
  checkDescriptor,
  type DescriptorOptions,
  parseReadmeClaimsTable,
  readTrellisClaims,
} from "./src/descriptor.ts";
export { type Golden, readGolden, writeGolden } from "./src/golden.ts";
export { checkSurface, type GateOptions, runGate } from "./src/gate.ts";
export { VERBS } from "./src/verbs.ts";
