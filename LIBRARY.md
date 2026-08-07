# LIBRARY — Tonality-Live durable lessons

Long-term memory for the knowledge loop. Append only via the write gate in
CLAUDE.md (evidence + falsifier required; prefer not writing over writing
unverified). Entry format:

`[Lxxxx] <title> | tier | added: YYYY-MM-DD | tags: … | lesson: … | evidence: … | falsifier: … | supersedes: …`

---

[L0001] Vendored beta SDK unblocks the build; the Node engine pin is only a warning
| tier: candidate | added: 2026-07-13
| tags: macos-build-codesign, ableton-sdk-quirks
| lesson: The build's only hard blocker is the three beta tarballs in
  extension/vendor/ (ableton-extensions-{sdk,cli} + create-extension). Once
  they match the file:./vendor/... versions in extension/package.json,
  `npm install` + `npm run build` succeed. The SDK's `engines: node
  >=24.14.1` vs the installed 24.10.0 surfaces as a non-fatal `EBADENGINE`
  warning only — it does NOT block install or build (unverified whether it
  bites at Extension-Host runtime).
| evidence: extension/package.json (file: deps + engines); npm install/build
  run 2026-07-13 produced dist/extension.js (23.3kb) under the warning.
| falsifier: a future SDK bump makes engine-strict fatal, OR the Extension
  Host refuses to load a bundle built on Node < 24.14.1.
| supersedes: —

[L0002] Zero-dependency test suites for both subsystems
| tier: candidate | added: 2026-07-13
| tags: bridge-contract, extension-lifecycle
| lesson: The repo tests with NO new deps. Extension: `node --import tsx
  --test src/**/*.test.ts` runs TypeScript unit tests because
  extension/src/transform.ts imports NoteDescription as `import type` (erased
  at runtime) — so transpose() loads with no SDK runtime. Test files live under
  src/ (type-checked by `tsc --noEmit`, which is fine) but never bundle:
  build.ts entryPoints is only extension.ts. Bridge: stdlib `unittest`, and
  every test class is `@unittest.skipUnless(mts importable)` so it degrades
  (skips, exit 0) when the engine is absent — mirroring `./verify full`. Run
  bridge tests with the Tonality venv python to actually exercise them.
| evidence: extension/src/transform.test.ts (7) + bridge/test_bridge.py (9)
  green via `./verify full` 2026-07-13; tsc stays green with test files included.
| falsifier: a local transform that imports a RUNTIME value from the SDK would
  break the tsx-only extension test (needs the SDK bundled/mocked); or moving
  test files out of src/ would drop them from the typecheck.
| supersedes: —

[L0003] "tonality-core" is NOT this repo's engine — the Python `mts` is
| tier: candidate | added: 2026-07-13
| tags: tonality-integration, bridge-contract
| lesson: There are two Tonality repos and the names invite the wrong choice.
  `~/Documents/tonality-core` (C++) sounds canonical and even bills itself as
  "the performance / generative / embedded main" — but it ports ONLY the frozen
  set-class identity substrate (public headers: bitmask, chirality, dft,
  json_format, setclass, table). It has no key induction, chord naming, or scale
  conform. Its own README names the pure-Python engine as "the spec's source of
  truth," and `Tonality/CPP_PORT.md:79-83` lists "the MCP/bridge tool surfaces"
  — precisely what our bridge consumes — as DEFERRED behind the Phase 6 fence.
  So Tonality-Live's provider is `~/Documents/Tonality` (the `mts` package), for
  both /analyze and the future /transform. This is a designed stability fence,
  not a backlog: expect tonality-core to stay unchanged as the engine grows.
| evidence: tonality-core/README.md (scope + source-of-truth statements); its
  include/tonality/ header list; Tonality/CPP_PORT.md:79-83 (deferred list);
  Tonality/ROADMAP.md:1704 (our brief recorded as Phase 7 generative-side).
| falsifier: Phase 6 freezes the 12-TET surface AND the analysis/bridge layers
  get ported — or Tonality-Live changes shape (audio-thread or engine embedded
  in the .ablx with no localhost bridge), which would make the C++ core the
  right target.
| supersedes: —
