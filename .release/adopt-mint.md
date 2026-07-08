---
bump: patch
---
Adopt @bounded-systems/mint for versioning + release provenance: `.release/` intents drive the next version, `version.yml` previews it on every PR, and `release.yml` emits signed in-toto provenance on the tag. JSR publish (`publish-jsr.yml`) and platform binaries (`binaries.yml`) are unchanged in behavior.
