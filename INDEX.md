# INDEX — Tonality-Live knowledge map

Compact retrieval layer for the knowledge loop. Read this in full each session;
pull only the matching LIBRARY.md entries into context. One line per lesson.

**Tags:** `ableton-sdk-quirks` · `bridge-contract` · `extension-lifecycle` ·
`tonality-integration` · `macos-build-codesign`

## Lessons

- [L0001] Vendored beta SDK unblocks the build; Node pin is a soft warning — `macos-build-codesign`, `ableton-sdk-quirks` (candidate)
- [L0002] Zero-dep TS+Python tests: node:test via tsx works because transform.ts's SDK import is type-only; bridge tests skipUnless mts importable — `bridge-contract`, `extension-lifecycle` (candidate)
- [L0003] "tonality-core" (C++) is NOT our engine — it ports only the frozen set-class kernel; our provider is the Python `mts` — `tonality-integration`, `bridge-contract` (candidate)
- [L0004] Load into Live by installing the .ablx (unzip to Extensions/<author>.<name>/, needs unsandboxed write); Developer Mode disables all other extensions; menu items nest under "Extensions" — `ableton-sdk-quirks`, `extension-lifecycle`, `macos-build-codesign` (candidate)
- [L0005] Silence in ExtensionHost.txt ≠ failure — log in activate(); check main Live process before suspecting code — `extension-lifecycle`, `ableton-sdk-quirks` (candidate)
- [L0006] Conform results come back onset-sorted (`Sequence.from_events` sorts at ingestion) — pair before/after via `report.edits`, never by position — `bridge-contract`, `tonality-integration` (candidate)
- [L0008] Resolve ExtensionHost.txt from the running host process (`logFilePath`), not by newest-mtime — beta updates move the versioned dir — `ableton-sdk-quirks`, `extension-lifecycle` (candidate)
- [L0007] Conform (proximity, lossy, cleanup) vs remap_by_degree (degree-preserving translation) — same-shaped inputs, opposite operations; UI must name which merges notes — `tonality-integration`, `bridge-contract` (candidate)
