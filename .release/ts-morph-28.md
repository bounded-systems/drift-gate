---
bump: minor
---
Bump `ts-morph` `^23` → `^28`, clearing GHSA-mh99-v99m-4gvg (CVSS 7.5) in the transitive `brace-expansion` chain for every consumer. The exported surface is unchanged, but the bundled TypeScript goes 5.5.2 → 6.0.2, so consumers opt in deliberately rather than receiving a compiler major in a patch.
