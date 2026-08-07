# ROADMAP — Tonality-Live

Single source of truth. Only the lead session (or the human) edits this file.
State lives here; conversations are ephemeral.

## Status

- **Phase:** shipped-v1 / hardening. v1 (analysis end-to-end + transpose) is
  authored and builds; the harness was retrofitted 2026-07-13.
- **Oracle:** `./verify fast` = `tsc --noEmit` + 7 `transpose` unit tests
  (node:test) + `py_compile`. `full` adds `npm run build` + 9 bridge glue
  tests (unittest; skip when the engine is absent) + a live bridge
  `/health`+`/analyze` contract check (skipped-with-notice when absent).
  **Remaining gap:** no end-to-end test in a live Ableton (out of scope).
- **Last human ratification:** 2026-07-13 — manifest RATIFIED (rung 1); push
  gated on a green oracle (D3, D4); Q-003 provider confirmed as the Python
  engine and Tonality's rulings ratified (D5, D6).

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
- **Status:** done (trace: traces/2026-07-13-q002-tests.md)
- **Scope:** `extension/src/transform.test.ts`, `bridge/test_bridge.py`, `./verify`.
- **Acceptance criteria:**
  1. ✅ `transpose` unit tests: shift correctness + MIDI 0–127 clamp/drop
     (`extension/src/transform.ts`); wired into `fast`. — 7 tests, node:test.
  2. ✅ Bridge marshalling + summary-shaping tests with pinned goldens; wired
     into `full`. — 9 tests, stdlib unittest. **Honest re-scope:** the golden
     pins the bridge's own `_summarize`/`_chord_label` shaping over a
     representative mts-shaped result, and `_sequence_from_payload` validation
     — NOT a golden of mts's analysis (that is the provider's domain and would
     violate the no-theory-here invariant, INTEGRATIONS rule 3).
  3. ✅ Dependency gate: resolved by choosing a **zero-dependency** stack
     (node:test + tsx, stdlib unittest), so no dependency was added — the
     human gate was satisfied by not needing it.
- **Out of scope:** end-to-end tests requiring a running Ableton Live; testing
  mts's analysis correctness (provider owns that).
- **Resolved:** test framework = zero-dep (node:test / unittest), per human
  decision 2026-07-13. Bridge tests SKIP (not fail) when the engine is absent,
  matching `full`'s degrade-visibly contract.

### Q-003 — Scale-conform via the /transform seam (blocked on Tonality)
- **Status:** blocked (upstream) — **rulings ratified 2026-07-13; awaiting the
  provider's implementation notice.** Exchange:
  `~/Documents/Tonality/integrations/Tonality-Live/{brief,response,ratify}.md`
  (ball: provider).
- **Provider is the Python engine (`mts`), not `tonality-core`** — see DECISIONS D6.
- **Scope:** `bridge/server.py` (`/transform` endpoint, currently 501),
  `extension/src/` (new context-menu action), `./verify` (contract check).
- **Acceptance criteria:**
  1. `mts` ships `conform_to_scale` + the `fit_to_key` wrapper (upstream,
     provider-owned; register-preserving, generative-side per their rulings).
  2. `/transform` returns altered notes in the same `NoteDescription` shape
     `/analyze` consumes; `full` gains a `/transform` contract check with the
     same skip-when-engine-absent behavior.
  3. New alter written back as one undo step (`withinTransaction`).
  4. Whatever the provider rules on pitch collisions (dedupe vs
     preserve-and-document) is honored; if they choose preserve, clip-hygiene
     dedupe may live here (that is not theory).
- **Out of scope:** implementing the snap locally — violates the no-theory-here
  invariant, under any schedule pressure. Also out: `revoice`, deferred by the
  provider to their Phase 7; `/transform` stays a visible 501 for it.
- **Open questions (with the provider):** the `tie_break` default — it governs
  every accidental in diatonic use, not a rare gap (C major: 5/5 out-of-scale
  pcs tie); and the collision ruling. Both raised in `ratify.md`.

## Decision log

<!-- One line per ratified decision, newest first, linking to traces/. -->
- 2026-07-13 — Q-003 rulings ratified with two refinements (tie-break default,
  collision ruling); provider confirmed as the Python engine, not tonality-core.
  (DECISIONS D5, D6; trace: traces/2026-07-13-ratify-q003.md)
- 2026-07-13 — Q-002 closed: zero-dep test suites (node:test + unittest)
  wired into the oracle; 7 extension + 9 bridge tests green. (trace:
  traces/2026-07-13-q002-tests.md)
- 2026-07-13 — Manifest ratified (rung 1); push gated on a green oracle.
  (DECISIONS D3, D4; trace: traces/2026-07-13-ratify-and-push-policy.md)
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
