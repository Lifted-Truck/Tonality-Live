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
