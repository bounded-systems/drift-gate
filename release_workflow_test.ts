// Guards the #5 fix: the compiled `drift` binaries have to actually reach the
// GitHub release, and the only arrangement that works is ONE workflow writing to
// it.
//
// A published GitHub release is immutable, so whichever workflow publishes first
// locks the others out. v0.2.0 and v0.3.0 both shipped with no binaries because
// `binaries.yml` raced `release.yml` on the same tag and lost:
//
//     HTTP 422: Cannot upload assets to an immutable release.
//
// So `release.yml` builds the binaries in a `needs:` job and hands them to mint's
// release-provenance via `assets-artifact`, which attaches them next to the
// provenance and publishes once. That is a *structure*, and a structure is exactly
// what a later edit undoes without noticing — hence these tests. They read the
// workflows as fixtures rather than asserting on a run, so they fail in CI on the
// PR that breaks the shape, not on the tag six weeks later when a release ships
// empty and immutable.

import { assert, assertEquals, assertMatch } from "@std/assert";

const workflowDir = new URL("./.github/workflows/", import.meta.url);
const releaseYml = await Deno.readTextFile(new URL("release.yml", workflowDir));

Deno.test("release.yml: binaries are built in-run and handed to the release job", () => {
  assertMatch(
    releaseYml,
    /^\s*needs:\s*binaries\b/m,
    "the release job must `needs: binaries` — without it the artifact may not exist when the release job looks for it",
  );
  assertMatch(
    releaseYml,
    /^\s*assets-artifact:\s*\S+/m,
    "release.yml must pass `assets-artifact` to release-provenance; that is what attaches the binaries " +
      "before the release is published (#5)",
  );
});

Deno.test("release.yml: the uploaded artifact name is the one the release job asks for", () => {
  // The coupling is by string, across a job boundary, so a rename on one side is
  // the obvious way to reintroduce a binary-less release. Anchored to the
  // upload-artifact step rather than the first `name:` in the file, which is the
  // workflow's own name.
  const uploaded = releaseYml.match(
    /upload-artifact@[^\n]*\n\s*with:\n\s*name:\s*(\S+)/,
  );
  const requested = releaseYml.match(/^\s*assets-artifact:\s*(\S+)\s*$/m);
  assert(
    uploaded,
    "no `name:` on the upload-artifact step — did the binaries job lose its upload?",
  );
  assert(requested, "no `assets-artifact:` input — see the previous test");
  assertEquals(
    requested[1],
    uploaded[1],
    "the artifact uploaded by the binaries job and the one release-provenance downloads must be the " +
      "same name, or the release ships without binaries",
  );
});

Deno.test("release.yml: the release job may read actions, so the artifact download can see the run", () => {
  // A called workflow only gets the intersection with its caller's grants, so
  // mint declaring `actions: read` is not enough — this caller has to grant it.
  assertMatch(
    releaseYml,
    /^\s*actions:\s*read\b/m,
    "`actions: read` is missing — mint's `gh run download` cannot fetch this run's artifact without it",
  );
});

Deno.test("release.yml: the mint pin cannot regress to a release that predates the fix", () => {
  // Dependabot converges `uses:` pins onto the referenced repo's LATEST TAG, not
  // its default-branch head — see the rationale in .github/dependabot.yml. mint's
  // latest tag is v0.5.0, which PREDATES the draft-until-attached fix and does not
  // define `assets-artifact` at all, so the weekly grouped "actions" bump is a
  // live path back to the #5 bug. Guard the predicate that actually matters: a
  // 40-hex commit SHA is fine (that is how the fix is consumed until mint tags
  // it), and a tag is fine only from v0.6.0, the first release to contain #30.
  const pin = releaseYml.match(
    /bounded-systems\/mint\/\.github\/workflows\/release-provenance\.yml@(\S+)/,
  );
  assert(pin, "release.yml no longer calls mint's release-provenance workflow");
  const ref = pin[1];
  if (/^[0-9a-f]{40}$/.test(ref)) return; // immutable commit — fine
  const tag = ref.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  assert(
    tag,
    `mint pin "${ref}" is neither a 40-hex commit SHA nor a v<x.y.z> tag`,
  );
  assert(
    Number(tag[1]) > 0 || Number(tag[2]) >= 6,
    `mint pin ${ref} predates the draft-until-attached fix (mint#30, first tagged in v0.6.0), so the ` +
      `release would be published before the binaries attach — the #5 bug, reintroduced. Pin a commit ` +
      `SHA or v0.6.0+.`,
  );
});

Deno.test("no second tag-triggered workflow writes to the GitHub release", async () => {
  // The #5 bug was two writers, not a bad flag. Any other workflow that creates,
  // uploads to, or edits the release reintroduces the race no matter how it is
  // ordered internally.
  const offenders: string[] = [];
  for await (const entry of Deno.readDir(workflowDir)) {
    if (!entry.isFile || entry.name === "release.yml") continue;
    const src = await Deno.readTextFile(new URL(entry.name, workflowDir));
    if (/gh release (create|upload|edit|delete)\b/.test(src)) {
      offenders.push(entry.name);
    }
  }
  assertEquals(
    offenders,
    [],
    `${
      offenders.join(", ")
    } write(s) to the GitHub release. release.yml must be the only writer — a ` +
      `published release is immutable, so a second writer loses the race and its assets never attach (#5)`,
  );
});
