---
bump: minor
---
`check` and `gate` gain a `--fix` flag: analyze a codebase, report the surface drift, then regenerate the golden to accept the new API surface in one step (eslint-style), instead of only failing. `--fix` auto-accepts surface drift only; descriptor drift (stale README pins) is reported, not silently rewritten.
