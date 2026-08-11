# ROADMAP — Tonality-Live

Single source of truth. Only the lead session (or the human) edits this file.
State lives here; conversations are ephemeral.

## Status

- **Phase:** shipped-v1 / hardening. Analysis, transpose, and the conform family
  (fit-to-key + conform-to-scale) are live end-to-end; harness retrofitted
  2026-07-13; Q-003 closed 2026-08-09.
- **Oracle:** `./verify fast` = `tsc --noEmit` + 13 unit tests (transpose +
  dedupeCollisions, node:test) + `py_compile`. `full` adds `npm run build` + 19
  bridge glue tests (unittest; skip when the engine is absent) + live
  `/health` + `/analyze` + `/transform` contract checks (skipped-with-notice
  when absent). Last full run 2026-08-09: green against a live bridge.
  **Remaining gap:** no *automated* end-to-end test in a live Ableton (out of
  scope — no harness for it). Manually verified once, 2026-08-10: all four
  actions registered, both conform dialogs applied correctly, one-undo-step
  confirmed by a single Cmd+Z reverting all four pitch changes, and collision
  dedupe confirmed (3 notes → 2, reported to the user). See
  traces/2026-08-10-live-run.md.
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

### Q-003 — Scale-conform via the /transform seam
- **Status:** done 2026-08-09 (trace: traces/2026-08-09-q003-conform.md). The
  engine shipped `conform_to_scale` + `fit_to_key` (their PR #259); `/transform`
  is live and both commands are wired. Exchange:
  `~/Documents/Tonality/integrations/Tonality-Live/{brief,response,ratify,response-2}.md`.
- **Both refinements were ruled our way:** tie-break default is now `previous`
  (context-sensitive, as proposed), and our tie-frequency table is pinned in
  *their* CI as `test_r1_the_tie_count_is_as_ratified`. Collisions: keep-and-report.
- **Provider is the Python engine (`mts`), not `tonality-core`** — see DECISIONS D6.
- **Scope:** `bridge/server.py` (`/transform` endpoint, currently 501),
  `extension/src/` (new context-menu action), `./verify` (contract check).
- **Acceptance criteria:**
  1. ✅ `mts` ships `conform_to_scale` + the `fit_to_key` wrapper (upstream —
     `mts/generate/conform.py`, register-preserving, generative-side).
  2. ✅ `/transform` returns altered notes in the same `NoteDescription` shape
     `/analyze` consumes; `full` gained a `/transform` contract check with the
     same skip-when-engine-absent behavior. Verified live: 4 notes, 2 snapped,
     1 collision, `tie_break=previous`.
  3. ✅ Both alters written back as one undo step (`withinTransaction`,
     `extension/src/extension.ts` `runConform`).
  4. ✅ Collision ruling honored: the provider chose keep-and-report, so
     `dedupeCollisions` drops the merged duplicates here (first-in-clip-order
     wins) and the result dialog reports how many were merged.
- **Out of scope (held):** implementing the snap locally — never happened; the
  engine owns every musical decision. `revoice` remains deferred by the provider
  to their Phase 7 and `/transform` still returns a visible 501 for it.
- **Beyond the brief:** `GET /scales` was added so the scale picker is served
  from the engine catalog rather than a hardcoded TypeScript copy that would go
  stale (37 scales).

### Q-005 — Transpose dialog turned "1" into "10" (fixed)
- **Status:** done 2026-08-10 (trace: traces/2026-08-10-transpose-input-fix.md)
- **Symptom (user-reported):** "transposition of 1 moves way further than a
  semitone." Reproduced: the semitones field shipped pre-filled with `value="0"`,
  so a caret landing *before* the zero — which is what clicking into the field
  does — turned a typed `1` into `10`. Ten semitones, with nothing on screen
  looking wrong.
- **Fix:** the field now ships empty with `placeholder="0"`, so there is no digit
  to prepend to. `extension/ui/transpose.html`.
- **Not the cause (ruled out with evidence):** `transpose()` itself is correct —
  measured in Live, inputs 1 and 2 moved every note exactly 1 and 2 semitones;
  the Enter path applies once; no stale queued dialog reply.
- **Known gap:** dialog input handling has no automated coverage (inline JS in
  HTML, not reachable from node:test). Verified by DOM check + in-Live measurement.

### Q-004 — Collapse the extension into one "workshop" GUI
- **Status:** open — **BLOCKED on a human ruling** (see open questions). Do not
  start: the acceptance criteria for "audition" cannot be written until the
  audition mechanism is chosen, and the SDK constrains that choice hard.
- **Intent (human, 2026-08-10):** replace the four separate context-menu commands
  with a *single* menu command that opens a workshop GUI which offers and
  auditions transformations, with a render button to commit them.
- **SDK reconnaissance (grounded — `@ableton-extensions/sdk` 1.0.0-beta.0
  `dist/index.d.mts`):**
  - `Ui` exposes exactly three methods: `registerContextMenuAction`,
    `showModalDialog(url, w, h)`, `withinProgressDialog`. **There is no
    non-modal/persistent panel API** — a modal dialog is the only container, and
    it blocks Live's UI while open.
  - **No transport or preview API anywhere.** `Song` has tempo/scenes/tracks/grid
    /rootNote/scaleName/scaleMode but no play/stop; `ClipSlot` has no `fire()`.
    The extension therefore *cannot* play anything itself.
  - `Resources.renderPreFxAudio(track: AudioTrack, start, end)` renders audio —
    but it takes an **AudioTrack**, so it cannot render a MIDI clip's instrument
    output. Not an audition path for MIDI without a resample step.
  - Useful find: `song.rootNote` / `scaleName` / `scaleMode` expose Live's own
    key/scale, so the workshop can default its target key instead of asking.
- **Feasible without new SDK surface:** one command + one modal; several
  transformations with parameters in one view; before/after note preview drawn in
  HTML from the bridge's returned notes/edits/collisions; chained ops applied as
  one undo step; key/scale defaulted from Live's setting.
- **Design constraint found while mocking up (load-bearing):** the engine returns
  `events` **onset-sorted**, not in input order, despite its docstring claiming
  input order. So `output[i]` is NOT `input[i]` — a positional before/after diff
  is silently wrong (claimed 17 moved where the engine snapped 10). **Pair the
  after-set to the before-set via `report.edits` on `(onset, from_midi)`**, which
  reproduces the engine's own counts exactly for all four transforms tested.
  Reported upstream as brief `tonality-live-002` (ball: provider); we are
  unblocked either way.
- **Mockup:** built 2026-08-10 with real engine output, working Web Audio
  audition, before/after roll with move connectors, chord strip from `/analyze`.
  Human reviewed it before the delivery mechanism was chosen.
- **Fit-to-Key and Conform-to-Scale are ONE operation — expose one control.**
  Verified byte-identical: `fit_to_key(C, major)` and
  `conform_to_scale("Ionian", C)` return the same `notes` AND the same `edits`;
  the engine's `fit_to_key` is a wrapper mapping major→Ionian, minor→Natural
  Minor, and the report's `scale_name` reads `Ionian` either way. So the workshop
  should offer **root + scale** as a single control with Major/Minor surfaced at
  the top of the list, not two separate transformations. Collapses 2 of the 4
  commands into one control.
- **Scale picker caveat:** the 37-name catalog contains three same-degree pairs —
  `Ionian`/`Major` and `Aeolian`/`Natural Minor` (true synonyms in 12-TET), and
  `Major Pentatonic`/`Pelog Selisir` (**not** synonyms — different musical
  traditions that collapse to one pitch-class set only because Pelog's real
  tuning isn't 12-TET). Group or annotate; do NOT dedupe by degree set, which
  would erase a distinction that isn't ours to erase.
- **Ruled by the human 2026-08-10:** audition = **Web Audio preview inside the
  dialog** (they confirmed other extensions do audition-in-popup, and that
  transport playback is impossible); the workshop should show the current MIDI
  with a full Tonality analysis, then a preview of the transformation applied.
  Eventual target: **one command replaces all four**.
- **Open questions (blocking, human):**
  1. ~~What does "audition" mean~~ — RULED: Web Audio in the dialog.
  2. ~~Do the four command IDs get removed~~ — RULED: yes, one replaces all four.
     Still needs the §Domain protected-path sign-off at the point of removal.
  3. **Delivery mechanism — still open.** Bridge-served page at
     `http://localhost:8765/workshop` (real assets, same-origin `/analyze` +
     `/transform`, no data-URL ceiling; but the workshop then requires the bridge,
     including for transpose) **vs** one large inlined `data:` URL (no bridge
     dependency for the page, but no assets and a fat payload per open).
     `showModalDialog` accepts `file:`, `data:`, `https:`, `http://localhost`.
  4. Does the workshop transform the clip in place, or always into a copy?
- **Out of scope until ruled:** any implementation.

### Q-006 — Context-aware transformation recommendations (vision, parked)
- **Status:** parked vision — **not started, and mostly not ours to build.**
  Recorded 2026-08-10 at the human's request; they noted it warrants a long
  conversation and a wishlist to Tonality first.
- **Intent (human):** the analysis uses smart context to *recommend*
  transformations based on established patterns — key transition, tonicization,
  re-voice, complexify or clean up harmony — possibly informed by
  genre / instrument / part / song-section dropdowns.
- **Boundary reading (why this is largely a Tonality ask, not a Tonality-Live one):**
  - "Recommend a transformation because this looks like a ii–V" is
    music-theoretic **judgment**. Per INTEGRATIONS rule 3 it belongs in the
    engine. This repo must not grow a recommender; it renders and applies.
  - Genre / instrument / section context are **priors**, and rule 4 requires
    priors to be versioned and evidenced. "Jazz wants ♭9s" is an empirical claim
    with a provenance burden, not a vibe — that is a real epistemic commitment
    for Tonality, and the thing most likely to make this project expensive.
  - **AI/deterministic boundary:** a recommender is *propose*, which AI may do —
    but it must rest on deterministic analysis, and nothing model-generated may
    sit in the transform path itself. Pin this before anyone reaches for an LLM
    inside the note pipeline.
  - Rule 7 (consume plural outputs): surface **ranked** candidates with the
    engine's margins, not one collapsed "best" answer. The workshop already has
    the shape for this — a recommendation list beside the transformation list.
- **Where each named pattern already stands upstream (from their ROADMAP):**
  modulation-path planning and scale/meter re-mapping are named Phase 7
  extensions, generative-side; tonicization pivots exist (`pivots_between`);
  `revoice` is deferred to Phase 7 (their Ruling 6); "complexify / clean up
  harmony" is unscoped anywhere.
- **Ours vs theirs:** ours = the context dropdowns, presenting ranked
  recommendations, and applying the chosen one. Theirs = every judgment that
  produces a recommendation.
- **Next step when the human wants it:** draft a wishlist brief to Tonality on
  the `integrations/Tonality-Live/` channel. Not filed yet — premature before the
  conversation.

## Decision log

<!-- One line per ratified decision, newest first, linking to traces/. -->
- 2026-08-09 — Q-003 closed: `/transform` live, "Fit to Key…" + "Conform to
  Scale…" wired, `GET /scales` added, collisions deduped consumer-side.
  (DECISIONS D7; trace: traces/2026-08-09-q003-conform.md)
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
