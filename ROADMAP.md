# ROADMAP — Tonality-Live

Single source of truth. Only the lead session (or the human) edits this file.
State lives here; conversations are ephemeral.

## Status

- **Phase:** shipped-v1 / hardening. v1 (analysis end-to-end + transpose) is
  authored and builds; the harness was retrofitted 2026-07-13.
- **Oracle:** `./verify fast` = `tsc --noEmit` + `py_compile bridge/server.py`.
  `full` adds `npm run build` + a live bridge `/health`+`/analyze` contract
  check (skipped-with-notice when the Tonality engine is absent). **Gaps:** no
  unit suites (transpose, bridge marshalling), no pinned goldens — see Q-002.
- **Last human ratification:** 2026-07-13 — manifest RATIFIED (rung 1);
  push permission gated on a green oracle (DECISIONS D3, D4).

## Invariants under active protection

See CLAUDE.md §Domain. The one most at risk from feature work: **no music
theory in this repo** — theory-driven alters go through the bridge's
`/transform` seam into `mts` (Q-003), never reimplemented locally.

## Queue

<!-- One block per item. An item without acceptance criteria is not workable —
     writing the criteria IS the first task. IDs are permanent; never reuse. -->

### Q-001 — Harness retrofit
- **Status:** done (trace: traces/2026-07-13-retrofit.md)
- **Scope:** CLAUDE.md, verify, ROADMAP, DECISIONS, INDEX/LIBRARY, CODEMAP,
  .claudeignore, project.manifest.json, .claude/, traces/; append-only to
  README.md and .gitignore.
- **Acceptance criteria:**
  1. `./verify fast` exits 0. ✅
  2. Re-running the retrofit is a no-op (marker-idempotent on README/.gitignore). ✅
  3. Existing source and README body untouched. ✅
- **Out of scope:** any change to extension/ or bridge/ source.

### Q-002 — Real oracle coverage (test-suite debt)
- **Status:** open
- **Scope:** `extension/` (add vitest), `bridge/` (add pytest), `./verify`.
- **Acceptance criteria:**
  1. `transpose` unit tests: shift correctness + MIDI 0–127 clamp/drop
     (`extension/src/transform.ts`); wired into `fast`.
  2. Bridge JSON⇄Sequence marshalling test with a pinned golden `/analyze`
     response for the C-E-G fixture; wired into `full`.
  3. Adding a dependency (vitest / pytest) is a human-gated decision — get
     approval before wiring.
- **Out of scope:** end-to-end tests requiring a running Ableton Live.
- **Open questions:** vitest vs node:test for the extension? (ask human)

### Q-003 — Theory-driven alters via the /transform seam (blocked on Tonality)
- **Status:** blocked (upstream) — brief filed: see
  `~/Documents/Tonality/integrations/Tonality-Live/brief.md`
- **Scope:** `bridge/server.py` (`/transform` endpoint, currently 501),
  `extension/src/` (new context-menu actions).
- **Acceptance criteria:**
  1. `mts` ships fit-to-key / scale-conform / revoice transform functions
     (upstream — provider-owned, per the brief).
  2. `/transform` returns altered notes in the same `NoteDescription` shape
     `/analyze` consumes; `full` gains a contract check.
  3. New alters written back as one undo step (`withinTransaction`).
- **Out of scope:** implementing the theory locally (violates the core
  invariant). This item cannot start until the upstream brief is answered.
- **Open questions:** owned by the brief's `respond-by`.

## Decision log

<!-- One line per ratified decision, newest first, linking to traces/. -->
- 2026-07-13 — Harness retrofitted at rung 1 (single thread); oracle wraps
  tsc + py_compile + build + bridge smoke; consumer brief filed to Tonality
  for the /transform functions. (trace: traces/2026-07-13-retrofit.md)

## Graduation criteria

This project graduates from interactive prototyping to autonomous queue work
when the remaining open questions are infrastructure problems rather than
judgment ones. Still in the judgment column today: (a) which transform
semantics `mts` should expose (Q-003, upstream); (b) test-framework choice
(Q-002). Until those are settled, work stays interactive (manifest autonomy
tier = interactive).
