import { assert, assertEquals } from "@std/assert";
import { diffSurface, extractSurface, normalizeType } from "./surface.ts";
import { gitBlobHash } from "./blob-hash.ts";

async function fixture(src: string): Promise<string> {
  const dir = await Deno.makeTempDir();
  const f = `${dir}/lib.ts`;
  await Deno.writeTextFile(f, src);
  return f;
}

Deno.test("extractSurface: exported names + kinds", async () => {
  const f = await fixture(`
export interface P { x: number; y: number; }
export function add(a: number, b: number): number { return a + b; }
export const V = "1.0.0";
export type ID = string | number;
`);
  const s = extractSurface(f);
  assertEquals(s.symbols.map((x) => x.name).sort(), ["ID", "P", "V", "add"]);
});

Deno.test("extractSurface: interface members are structural (adding a field changes the signature)", async () => {
  const a = extractSurface(await fixture(`export interface P { x: number; }`));
  const b = extractSurface(
    await fixture(`export interface P { x: number; y: number; }`),
  );
  const sa = a.symbols.find((s) => s.name === "P")!.signature;
  const sb = b.symbols.find((s) => s.name === "P")!.signature;
  assert(sa !== sb, "adding an interface field must change the signature");
});

Deno.test("diffSurface: added / removed / changed", () => {
  const golden = [
    {
      name: "add",
      kind: "FunctionDeclaration",
      signature: "(a: number, b: number) => number",
    },
    { name: "V", kind: "VariableDeclaration", signature: '"1.0.0"' },
  ];
  const live = [
    { name: "V", kind: "VariableDeclaration", signature: "2" },
    {
      name: "sub",
      kind: "FunctionDeclaration",
      signature: "(a: number) => number",
    },
  ];
  const d = diffSurface(golden, live);
  assert(d.some((x) => x.startsWith("REMOVED export: add")));
  assert(d.some((x) => x.startsWith("ADDED export: sub")));
  assert(d.some((x) => x.startsWith("CHANGED signature: V")));
});

Deno.test("normalizeType strips import() paths + collapses whitespace", () => {
  assertEquals(normalizeType('import("/a/b").Foo  |  string'), "Foo | string");
});

Deno.test("gitBlobHash equals `git hash-object`", async () => {
  // git hash-object of the literal bytes "hello\n"
  const h = await gitBlobHash(new TextEncoder().encode("hello\n"));
  assertEquals(h, "ce013625030ba8dba906f756967f9e9ca394464a");
});
