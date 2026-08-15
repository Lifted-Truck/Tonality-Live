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

[L0007] Conform ≠ remap: same-looking inputs, opposite operations
| tier: candidate | added: 2026-08-11
| tags: tonality-integration, bridge-contract
| lesson: Two engine tools both take "a scale and a root" and return notes, and
  choosing wrong silently gives the user something else. `conform_to_scale`
  answers "make these notes LEGAL in S" — proximity, many-to-one, lossy, for
  cleanup. `remap_by_degree` answers "TRANSLATE this into S" — degree→degree,
  bijective on in-scale material, walks survive by construction. A user who picks
  a scale from a dropdown to "make it Dorian" means **translate**; routing that
  into conform destroys scale walks (and Ableton's own Scale tool has the same
  failure, for the same reason). `fit_to_key` is merely a preset of conform.
  **The two are distinguished by user intent, which the signatures do not reveal**
  — so the UI must name the difference, including which one merges notes.
  Unequal cardinality (7 degrees → 5) makes translation impossible by pigeonhole;
  the engine refuses with a legible reason, and surfacing that refusal is correct
  behaviour, not an error to hide.
| evidence: descending walk `G F E D C` → C Natural Minor — conform returns
  `G F F D C` (4 distinct of 5; destroyed even at EQUAL cardinality), remap
  returns `G F D♯ D C` (5 distinct, intact); remap to Minor Pentatonic raises
  ValueError. Provider notice notice-conform-vs-remap.md; adopt-conform-vs-remap.md.
| falsifier: the engine gains a walk-aware conform, or span-policy knobs land
  (their gap 31(b)/(c)) making unequal-cardinality translation possible — either
  would change the routing advice, not the conform/remap distinction itself.
| supersedes: — (but CORRECTS a same-day conclusion in this repo that fit/conform
  equivalence implied one UI control; the equivalence is real, the inference was not)

[L0006] The engine returns conform results onset-sorted — never pair by position
| tier: candidate | added: 2026-08-10
| tags: bridge-contract, tonality-integration
| lesson: `conform_to_scale` / `fit_to_key` return `events` **sorted by onset**,
  not in the order they were sent, even though the docstring says "in the input's
  note order". So `output[i]` is not `input[i]`. Writing the result to
  `clip.notes` is unaffected (note order is meaningless in a MIDI clip) and
  collision dedupe is safe (it keys on pitch+onset+duration), but ANY before/after
  pairing must go through `report.edits`, matching `(onset, from_midi)` →
  `to_midi`. A positional diff is silently wrong, not loudly wrong.
| evidence: 20-note clip sent with block chords first, melody second — input
  onsets `0,0,0,2,2,2,4,4,4,6,6,6,0,1,...` returned as `0,0,0,0,1,2,2,2,2,3,...`.
  Positional comparison claimed 17 notes moved where the engine reported 10;
  edit-based pairing reproduces the engine's counts exactly (2/8/10/3) with zero
  unmatched edits. Filed upstream as brief tonality-live-002.
| falsifier: the provider takes option (1) of that brief and assembles output by
  original index — then input order IS preserved and positional pairing becomes
  valid (but pairing via `edits` still works, so prefer it regardless).
| supersedes: —

[L0009] The host's fs sandbox binds Node, not the children Node spawns
| tier: candidate | added: 2026-08-15
| tags: ableton-sdk-quirks, extension-lifecycle
| lesson: The Extension Host runs Node with `--permission --allow-child-process
  --allow-fs-read=<Extensions dir> --allow-fs-read=<Extensions Data dir>
  --allow-fs-write=<Extensions Data dir>`. Two consequences that pull in
  opposite directions: (a) `child_process.spawn` of an interpreter anywhere on
  disk WORKS — the permission model does not propagate to the child; but (b)
  any Node fs call on a path outside the allowlist (`existsSync`, `readFileSync`
  on `~/Documents/...`) throws "Access to this API has been restricted. Use
  --allow-fs-read to manage permissions." So do not "helpfully" pre-check a
  path you are about to spawn — let spawn's ENOENT tell you. The only
  extension-writable location is `environment.storageDirectory` (under
  Extensions Data); machine-local config belongs there.
| evidence: 2026-08-15 — spawn of the venv python from an identically-flagged
  node ran server.py up to bind(); the same build's existsSync(cfg.python)
  failed live in Live with the restricted-API error, masquerading as a bad
  config. Removing the pre-flight made auto-start work first try.
| falsifier: a future SDK/host loosens or documents the allowlist, or Node's
  permission model starts propagating to spawned children.
| supersedes: —

[L0008] Resolve ExtensionHost.txt from the running host, never by newest-mtime
| tier: candidate | added: 2026-08-11
| tags: ableton-sdk-quirks, extension-lifecycle
| lesson: The host log lives in a **version-stamped** directory
  (`~/Library/Preferences/Ableton/Live <ver>/ExtensionHost.txt`), and a beta
  update silently moves it — Live went 12.4.5b10 → b11 mid-session here. Picking
  the directory by newest mtime (`ls -dt`) is wrong twice over: an old version's
  folder can be touched more recently than the live one (b7 sorted first while
  b11 was in use), so you end up reading a stale log and concluding the extension
  did not load, or that an old build is still installed. Resolve it from the
  running process instead:
  `ps aux | grep -o "logFilePath':'[^']*'"` — the host is launched with its log
  path as an argument, so this is authoritative.
| evidence: 2026-08-11 — spent a cycle reading b10's log showing "4 MidiClip
  actions" while the running host wrote to b11; `ls -dt` ranked b7 first by mtime.
| falsifier: the SDK/CLI gains a documented way to query the active log path, or
  Live stops version-stamping the preferences directory.
| supersedes: — (sharpens L0005's diagnostic order: step 0 is "am I even reading
  the right log?")

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
