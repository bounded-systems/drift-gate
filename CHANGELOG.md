# Changelog

## 0.2.0 — 2026-07-08

### Minor

- `--fix` on `check` and `gate`: on surface drift, regenerate the golden to accept the new surface (reported with exit 1 when the flag is absent). Descriptor drift is reported, not auto-rewritten — re-pinning belongs at the source.

### Patch

- Adopt @bounded-systems/mint for versioning + release provenance: `.release/` intents drive the next version, `version.yml` previews it on every PR, and `release.yml` emits signed in-toto provenance on the `v<version>` tag. JSR publish (`publish-jsr.yml`) and platform binaries (`binaries.yml`) are unchanged in behavior.
