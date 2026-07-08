// Surface extraction — the general-purpose core that works on ANY TS/JS module,
// with no `deno` runtime and no WASM. Uses ts-morph (the TypeScript compiler
// API), so a `deno compile`d binary is fully self-contained.
//
// A "surface" is the set of a module's exported symbols, each reduced to a
// stable { name, kind, signature }. Source positions and doc comments are never
// part of it, so cosmetic edits don't read as drift; a pinned ts-morph (hence
// TypeScript) version keeps the projection reproducible.
//
// Signatures are structural where it matters: functions render as their
// param/return type; interfaces and classes expand their public members (so
// adding a field IS drift); everything else uses the resolved type text.
import { Node, Project, ts } from "ts-morph";
import type { ClassDeclaration, InterfaceDeclaration } from "ts-morph";
import type { Surface, SymbolEntry } from "./types.ts";

const IMPORT_PATH = /import\((?:"[^"]*"|'[^']*')\)\./g;

/** Strip `import("/abs/path").` prefixes and collapse whitespace. */
export function normalizeType(text: string): string {
  return text.replace(IMPORT_PATH, "").replace(/\s+/g, " ").trim();
}

/** The ts-morph / TypeScript versions a surface was extracted with. */
export function toolVersions(): { tsMorph: string; typescript: string } {
  return { tsMorph: "ts-morph", typescript: ts.version };
}

// deno-lint-ignore no-explicit-any
function safeType(node: any, ctx?: unknown): string {
  try {
    return normalizeType(node.getType().getText(ctx));
  } catch {
    return "<unresolved>";
  }
}

// deno-lint-ignore no-explicit-any
function isPublicMember(m: any): boolean {
  const scope = typeof m.getScope === "function" ? m.getScope() : "public";
  const named = typeof m.getName === "function" ? String(m.getName()) : "";
  return scope === "public" && !named.startsWith("#");
}

// deno-lint-ignore no-explicit-any
function memberSignature(m: any): string {
  const name = typeof m.getName === "function" ? m.getName() : "";
  const opt = typeof m.hasQuestionToken === "function" && m.hasQuestionToken()
    ? "?"
    : "";
  const stat = typeof m.isStatic === "function" && m.isStatic()
    ? "static "
    : "";
  return `${stat}${name}${opt}: ${safeType(m, m)}`;
}

/** A stable structural signature for one exported declaration. */
function signatureOf(d: Node): string {
  if (Node.isInterfaceDeclaration(d) || Node.isClassDeclaration(d)) {
    const decl = d as InterfaceDeclaration | ClassDeclaration;
    const props = decl.getProperties().filter(isPublicMember);
    const methods = decl.getMethods().filter(isPublicMember);
    const members = [...props, ...methods].map(memberSignature).sort();
    const kw = Node.isClassDeclaration(d) ? "class" : "interface";
    return `${kw} { ${members.join("; ")} }`;
  }
  return safeType(d, d);
}

/**
 * Extract the exported surface of a TS/JS entry module. Read-only; resolves the
 * module's own imports for type text (external types may render as `any` if the
 * target repo's dependencies are not installed — run it where deps exist).
 */
export function extractSurface(entryPath: string): Surface {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noEmit: true,
    },
    skipAddingFilesFromTsConfig: true,
  });
  const sf = project.addSourceFileAtPath(entryPath);
  const exported = sf.getExportedDeclarations();

  const symbols: SymbolEntry[] = [];
  for (const [name, decls] of exported) {
    for (const d of decls) {
      symbols.push({ name, kind: d.getKindName(), signature: signatureOf(d) });
    }
  }
  symbols.sort((a, b) =>
    a.name === b.name
      ? (a.kind === b.kind
        ? a.signature.localeCompare(b.signature)
        : a.kind.localeCompare(b.kind))
      : a.name.localeCompare(b.name)
  );

  return { module: entryPath.split("/").pop() ?? entryPath, symbols };
}

/** Diff a golden surface against a live one; returns human-readable drift lines. */
export function diffSurface(
  golden: readonly SymbolEntry[],
  live: readonly SymbolEntry[],
): string[] {
  const failures: string[] = [];
  const key = (s: SymbolEntry) => `${s.name} [${s.kind}]`;
  const g = new Map(golden.map((s) => [key(s), s]));
  const l = new Map(live.map((s) => [key(s), s]));

  for (const k of g.keys()) {
    if (!l.has(k)) failures.push(`REMOVED export: ${k}`);
  }
  for (const k of l.keys()) if (!g.has(k)) failures.push(`ADDED export: ${k}`);
  for (const [k, gs] of g) {
    const ls = l.get(k);
    if (ls && ls.signature !== gs.signature) {
      failures.push(`CHANGED signature: ${k}`);
    }
  }
  return failures;
}
