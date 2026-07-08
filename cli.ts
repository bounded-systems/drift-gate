// drift — the standalone CLI. Runnable with Deno (`deno run -A cli.ts`) or as a
// self-contained `deno compile`d binary (no Deno runtime, no network). The verb
// registry (src/verbs.ts) also projects to MCP/OpenAPI via verbspec.
import { dispatch, render } from "verbspec";
import { VERBS } from "./src/verbs.ts";

const BIN = "drift";

function usage(): string {
  const lines = [
    "drift — surface & descriptor drift gate",
    "",
    `Usage: ${BIN} <verb> [--flags]     (${BIN} <verb> --help for a verb's flags)`,
    "",
    "Verbs:",
  ];
  for (const [id, v] of Object.entries(VERBS)) {
    lines.push(
      `  ${id.padEnd(11)} ${(v as { summary?: string }).summary ?? ""}`,
    );
  }
  lines.push(
    "",
    "Examples:",
    `  ${BIN} surface --entry ./mod.ts`,
    `  ${BIN} update  --entry ./mod.ts --golden .drift/surface.json`,
    `  ${BIN} check   --entry ./mod.ts --golden .drift/surface.json`,
    `  ${BIN} gate    --root . --entry mod.ts --golden .drift/surface.json`,
  );
  return lines.join("\n");
}

if (import.meta.main) {
  const args = Deno.args;
  if (
    args.length === 0 || args[0] === "help" || args[0] === "--help" ||
    args[0] === "-h"
  ) {
    console.log(usage());
    Deno.exit(0);
  }
  try {
    const result = await dispatch(VERBS, args, BIN);
    if (result.kind === "help") {
      console.log(result.text);
      Deno.exit(0);
    }
    console.log(render(result.output));
    const out = result.output as { ok?: boolean };
    Deno.exit(out && typeof out === "object" && out.ok === false ? 1 : 0);
  } catch (e) {
    console.error(`${BIN}: ${e instanceof Error ? e.message : String(e)}\n`);
    console.error(usage());
    Deno.exit(2);
  }
}
