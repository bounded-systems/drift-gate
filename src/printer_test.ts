// Type-printer stability — the property the ts-morph pin exists to protect.
//
// surface.ts renders signatures via `getType().getText()`, so the projection is
// only as reproducible as the TypeScript compiler bundled inside ts-morph. A
// ts-morph major moves that compiler (23.0.0 vendors TypeScript 5.5.2, 28.0.0
// vendors 6.0.2), and any change in how it prints a type silently re-renders
// every consumer's golden as drift.
//
// The rest of the suite checks the extraction LOGIC — names, kinds, structural
// expansion, diffing. None of it pins the rendered text, so a printer change
// passes it cleanly. This file pins the text, over the constructs whose
// rendering is most likely to move: union member ordering, optional vs
// `| undefined`, tuple forms, indexed/keyof/mapped/template-literal types, and
// class member visibility filtering.
//
// When this fails after a deliberate toolchain bump, that is the test working:
// diff the expected against the actual, confirm the change is cosmetic, and
// update the constants — the same "regenerate on an intentional change, commit
// the diff" contract the golden itself uses. Do NOT relax the assertions to
// make it pass; the whole point is that the change becomes visible.
import { assertEquals } from "@std/assert";
import { extractSurface } from "./surface.ts";

const SRC = `
export interface Unions {
  discriminated: { kind: "a"; v: string } | { kind: "b"; v: number };
  mixedLiteral: 1 | "two" | true;
  nested: Array<string | number> | null;
  withNull: string | null;
}
export interface Optionality {
  opt?: string;
  optOrUndef?: string | undefined;
  orUndef: string | undefined;
  readonly ro: string;
}
export interface Collections {
  namedTuple: [first: string, second?: number];
  rec: Record<string, number>;
  restTuple: [string, ...number[]];
  roArr: readonly string[];
  tuple: [string, number];
}
export interface Advanced {
  idx: Collections["tuple"];
  keyofT: keyof Collections;
  pick: Pick<Unions, "withNull">;
  tmpl: \`prefix-\${string}\`;
}
export class Shape {
  public name: string = "";
  public optional?: number;
  static kind: string = "shape";
  readonly frozen: boolean = true;
  #secret: string = "";
  private hidden: string = "";
  protected guarded: string = "";
  area(scale: number): number { return scale; }
}
`;

/** Exact rendered signatures under the pinned toolchain. */
const EXPECTED: Record<string, string> = {
  Advanced:
    'interface { idx: [string, number]; keyofT: keyof Collections; pick: Pick<Unions, "withNull">; tmpl: `prefix-${string}` }',
  Collections:
    "interface { namedTuple: [first: string, second?: number | undefined]; rec: Record<string, number>; restTuple: [string, ...number[]]; roArr: readonly string[]; tuple: [string, number] }",
  Optionality:
    "interface { opt?: string | undefined; optOrUndef?: string | undefined; orUndef: string | undefined; ro: string }",
  Shape:
    "class { area: (scale: number) => number; frozen: boolean; name: string; optional?: number | undefined; static kind: string }",
  Unions:
    'interface { discriminated: { kind: "a"; v: string; } | { kind: "b"; v: number; }; mixedLiteral: true | 1 | "two"; nested: (string | number)[] | null; withNull: string | null }',
};

async function fixture(src: string): Promise<string> {
  const dir = await Deno.makeTempDir();
  const f = `${dir}/lib.ts`;
  await Deno.writeTextFile(f, src);
  return f;
}

Deno.test("type printer renders these constructs exactly as pinned", async () => {
  const surface = extractSurface(await fixture(SRC));
  const actual = Object.fromEntries(
    surface.symbols.map((s) => [s.name, s.signature]),
  );
  // One assert over the whole map: a printer change reports every affected
  // construct at once rather than stopping at the first.
  assertEquals(actual, EXPECTED);
});

Deno.test("printer test is load-bearing: no signature silently unresolved", async () => {
  const surface = extractSurface(await fixture(SRC));
  const unresolved = surface.symbols.filter((s) =>
    s.signature.includes("<unresolved>")
  );
  assertEquals(
    unresolved.map((s) => s.name),
    [],
    "a fixture that fails to resolve would match any expectation trivially",
  );
});
