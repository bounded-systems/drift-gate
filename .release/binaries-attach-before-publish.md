---
bump: patch
---
release: build the platform binaries inside `release.yml` and attach them before the GitHub release is published, so the compiled `drift` binaries actually ship (a published release is immutable, and the old separate `binaries.yml` raced it and lost)
