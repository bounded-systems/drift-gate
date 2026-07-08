// Shared types for the drift-gate engine. The engine reads a target repo/module
// read-only and never mutates it.

/** One exported symbol in a module's public surface. */
export interface SymbolEntry {
  name: string;
  kind: string;
  /** Normalized type text (import() paths stripped, whitespace collapsed). */
  signature: string;
}

/** A module's exported surface — the diffable projection. */
export interface Surface {
  module: string;
  symbols: SymbolEntry[];
}

/** A `descriptor.proof.claims[]` entry from a repo's trellis.json (org convention). */
export interface Claim {
  claim: string;
  provenBy: string;
  via: string;
}

/** A `(provenBy, pin)` row parsed from a generated README claims table. */
export interface PinRow {
  provenBy: string;
  pin: string;
}

/** Result of a single check. `skipped` = not applicable to this repo (not a failure). */
export interface CheckResult {
  name: string;
  ok: boolean;
  failures: string[];
  notes: string[];
  skipped?: boolean;
}
