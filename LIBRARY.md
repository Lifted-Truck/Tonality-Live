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

[L0004] Loading into Live: install the .ablx, don't reach for Developer Mode
| tier: candidate | added: 2026-08-10
| tags: ableton-sdk-quirks, extension-lifecycle, macos-build-codesign
| lesson: `npm start` (`extensions-cli run`) REQUIRES Developer Mode (Settings →
  Extensions), and enabling it makes Live shut down the Extension Host it
  normally runs — which disables every installed extension on the machine (~41
  here, incl. able-mcp) until it is turned back off. To test a shipping build,
  install instead: `npm run package` emits `extension/tonality-<ver>.ablx` (at
  the package root, NOT dist/), then unzip it into
  `~/Library/Application Support/Ableton/Extensions/<author-slug>.<name>/`
  (here `julian-smith.tonality`) — layout is just `manifest.json` + `dist/`.
  Restart Live; it appears in Settings → Extensions. The write needs
  `dangerouslyDisableSandbox: true` or it lands in a sandbox overlay Live can't
  see. Testing note: extension actions are NOT top-level in a clip's
  context menu — they nest under a single **Extensions** submenu.
| evidence: SDK docs getting-started/2-quick-start + development/2-execution
  ("This is required — without it, npm start cannot connect to Live"); two
  `npm start` runs failed with "bring-up timed out (control channel handshake)"
  with Developer Mode off (user-confirmed off); hand-install + restart produced
  working menu items and `[tonality]` log lines on 2026-08-10.
| falsifier: the beta ships a CLI install command or a documented drag-drop
  install path that supersedes hand-unzipping; or a future Live keeps hosting
  installed extensions while Developer Mode is on.
| supersedes: —

[L0005] An extension that logs nothing looks exactly like one that failed
| tier: candidate | added: 2026-08-10
| tags: extension-lifecycle, ableton-sdk-quirks
| lesson: Live's `ExtensionHost.txt` is the only window into extension loading,
  and it contains ONLY what each extension chooses to log. Our `activate()`
  logged nothing, so the absence of a `[tonality]` line was read as a failed
  load while the extension was in fact working — wasted a real chunk of a
  debugging session chasing Developer Mode and install paths. Every other
  extension on this host announces itself; silence therefore reads as breakage.
  `activate()` now logs on entry and after registering its actions. Diagnostic
  order that actually works: (1) is the MAIN Live process running
  (`pgrep -f MacOS/Live` — AddOns/PluginScanner helpers linger and look like
  Live), (2) did the host start (`Started: Extension Host` in the log), (3) is
  the extension listed in Settings → Extensions, (4) only then suspect code.
| evidence: extension/src/extension.ts activate() console.log calls; host log
  2026-08-10T12:29:58 `[tonality] activating` + `ready — 4 MidiClip actions
  registered`; the earlier same-day session where no log line existed yet and
  all four menu actions nevertheless worked.
| falsifier: the SDK starts logging activation for every extension itself,
  making per-extension logging redundant.
| supersedes: —
