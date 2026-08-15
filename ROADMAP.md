# ROADMAP — Tonality-Live

Single source of truth. Only the lead session (or the human) edits this file.
State lives here; conversations are ephemeral.

## Status

- **Phase:** shipped-v1 / hardening. Analysis, transpose, and the conform family
  (fit-to-key + conform-to-scale) are live end-to-end; harness retrofitted
  2026-07-13; Q-003 closed 2026-08-09.
- **Oracle:** `./verify fast` = `tsc --noEmit` + 13 unit tests (transpose +
  dedupeCollisions, node:test) + `py_compile`. `full` adds `npm run build` + 27
  bridge glue tests (unittest; skip when the engine is absent) + live
  `/health` + `/analyze` + `/transform` contract checks — conform, remap
  walk-preservation, and the unequal-cardinality refusal (skipped-with-notice
  when absent). Last full run 2026-08-11: green against a live bridge.
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
- **Status:** in progress — **wired into Live and reported working** (human,
  2026-08-15: "it seems to be working so far"). `tonality.workshop` opens the
  bridge-served page from a real clip via `/session` and renders back in one
  undo step (b897755). Header now carries an engine status indicator (56fbe7f).
  Still to do before it can *replace* the four commands: (a) more time in Live
  to trust it, (b) remove the old items — protected path, needs the human's gate.
  Follow-on features are queued as Q-011…Q-018.
- **Round 2 of human feedback applied 2026-08-11** (trace:
  traces/2026-08-11-workshop-feedback.md): in-scale count shown alongside
  outside; scale dropdown shows each scale's note count and marks
  wrong-cardinality targets red with ✕ *before* you hit a refusal; the Root/Scale
  control is now **persistent and shared by every mode**, sitting below the
  transformation params (the reference dropdown no longer says "below" — a
  positional label that had already gone stale); "use detected key as source"
  toggle for translate, on by default; the refusal overlay gained a
  **"Constrain to this scale instead"** button that switches op and keeps the
  target. Also relabelled: notes left outside after a REMAP are
  "chromatic (kept by design)", not "outside" — see the answered question below.
- **Answered (human asked whether purple-after-transform was a bug):** it is
  correct and it is Q-008(b) already working. Measured against the engine —
  before: 6 of 20 outside C Dorian; after **conform**: 0; after **remap**: 2
  (engine agrees: `notes_diatonic=18, notes_chromatic=2`). Conform flattens
  everything into the scale; remap is degree-preserving, so chromatic tones keep
  their alteration by design. The behaviour was right, the *label* was wrong.
- **Round 3 of human feedback applied 2026-08-11** (trace:
  traces/2026-08-11-workshop-feedback.md): a **piano keyboard gutter** down the
  left of the roll — every lane named, in-scale lanes lit, so a scale can be read
  off the edge; a **second chord strip** showing the engine's naming of the
  *transformed* material beneath the detected one (C Ionian → C Dorian reads
  `C maj → C min`, `A min → A dim`, `G maj → G min`); and **"fold chromatic tones
  into the scale"** as a toggle inside Translate rather than an always-on
  behaviour.
- **How the fold toggle is implemented, and its honest limit:** `remap_by_degree`
  has **no** chromatic option — preserving character is inherent to degree
  mapping — and `modal_transform`'s policies are `("rhetoric", "strict")`, where
  strict *refuses* on ambiguity rather than folding. So folding is a
  **composition of two engine calls**: remap, then conform the still-chromatic
  tones to the target. Labelled in the UI as "two engine steps — not a single
  blessed operation". **Open question for the provider:** is composing
  remap→conform the blessed idiom for this, or should the engine expose it
  natively? Worth folding into the Q-008(b) conversation rather than a new brief.
- **Round 5 (2026-08-11): constrain can transpose first, and the escape hatch
  computes it.** Human insight — when translation is refused, the closest
  approximation is not constrain alone but **constrain + transpose**, because
  translation moves the music to the new tonic while a bare snap leaves it on the
  old one. Measured against a translation that *is* possible (so there is ground
  truth), summing |pitch difference| over the clip:
  | target | auto shift | constrain only | transpose + constrain |
  |---|---|---|---|
  | G Dorian | −5 | 104 | **4** |
  | D Dorian | +2 | 36 | **4** |
  | F Dorian | +5 | 100 | **4** |
  | A♯ Dorian | −2 | 39 | **4** |
  9–26× closer, and the residual 4 is exactly the chromatic tones translation
  keeps and conform folds. **The normalisation is load-bearing:** the shift must
  be the *nearest* interval (|iv| ≤ 6), because remap is register-preserving —
  C→G is 5 down, not 7 up. Using +7 measured **worse than not shifting at all**
  (242 vs 104), which is why this was tested rather than assumed.
- **Prototype covers:** analysis-only default with Render disabled; conform /
  remap / transpose; live `/analyze` chord strip coloured by function; before/
  after roll with ghost outlines and move connectors; out-of-scale marking
  against either the detected key or the target scale; the unequal-cardinality
  refusal as a first-class UI state carrying the engine's own reason; Web Audio
  audition with playhead. Both portability rules honoured (`loadInput()` seam,
  injected base URL).
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
- **Fit-to-Key and Conform-to-Scale are ONE operation.** Verified byte-identical:
  `fit_to_key(C, major)` and `conform_to_scale("Ionian", C)` return the same
  `notes` AND the same `edits`; `fit_to_key` is a wrapper mapping major→Ionian,
  minor→Natural Minor, and `scale_name` reads `Ionian` either way. So Fit to Key
  is a *preset of* conform, not its own transformation.
- **CORRECTION (2026-08-11) — do NOT collapse scale selection into one control.**
  The line above previously concluded "therefore expose one root+scale control".
  That inference was wrong and would have shipped a silent substitution: picking
  a scale to *translate* into ("make this Dorian") would have run a proximity
  snap. Provider notice `notice-conform-vs-remap.md` (adopted) draws the real
  line — the two tools answer different questions and are distinguished by user
  **intent**, which the signatures do not reveal:
  | tool | question | character |
  |---|---|---|
  | `conform_to_scale` | make these notes *legal* in S | proximity, many-to-one, **lossy** — cleanup |
  | `remap_by_degree` | *translate* this music into S | degree-preserving, bijective in-scale — translation |
  Verified locally on a descending walk `G F E D C` → C Natural Minor: conform
  gives `G F F D C` (E merges into F, walk destroyed **even at equal
  cardinality**), remap gives `G F D♯ D C` (intact). So the workshop presents
  *Clean up / constrain* and *Translate to scale or mode* as separate intents,
  labelled with which one merges notes.
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
  3. Does the workshop transform the clip in place, or always into a copy?

- **Delivery: bridge-served during development, decided at ship time (human,
  2026-08-10).** The page content is identical either way — only delivery
  differs — so this stays reversible IF two rules are honoured from the first
  commit:
  1. **The page never assumes where its input came from.** One `loadInput()`
     seam: fetch a bridge session in served mode, read an inlined constant in
     `data:` mode. Nothing else in the page knows the difference.
  2. **The bridge base URL is an injected constant, never `location.origin`.**
     In `data:` mode the origin is opaque/null, so calls must go to an absolute
     `http://localhost:<port>`. (Cross-origin from `data:` already works — the
     bridge sends `Access-Control-Allow-Origin: *`.)
  Break either rule and the switch stops being a delivery change and becomes a
  rewrite. `showModalDialog` accepts `file:`, `data:`, `https:`, `http://localhost`.

- **Additional requirements (human, 2026-08-10):**
  - **Transformation must be de-selectable.** A "None — analysis only" row sits at
    the top of the list and is the **default**, so opening the workshop is just
    observing the analysis; Render is disabled while it's selected. This is what
    lets one command absorb "Analyze with Tonality".
  - **"Mark out-of-scale notes" toggle**, with the reference scale from either
    (a) the clip — note there are two distinct readings to disambiguate: Live's
    own `song.rootNote`/`scaleName`/`scaleMode` (free, no engine call) vs the
    engine's *detected* key from `/analyze`; offer both, labelled distinctly — or
    (b) an explicitly set target scale (the root+scale control).
    **Invariant check:** membership testing is
    `((pitch % 12) - root + 12) % 12 ∈ degrees` — pure arithmetic against degrees
    the **engine** supplied. We never derive a scale locally; that stays theory.
    Needs a small bridge addition: `/analyze`'s summary currently returns the key
    as `{name, score, margin}` with **no degrees**, and mapping "C major" → pcs
    locally would duplicate the engine's catalog. Have the bridge pass the
    detected key's degrees through instead.
- **Out of scope until ruled:** any implementation.

### Q-007 — Expose `remap_by_degree` (+ `modal_transform`) on /transform
- **Status:** done 2026-08-11 (trace: traces/2026-08-11-q007-remap.md). `remap_by_degree`
  is live on `/transform`; `modal_transform` explicitly deferred with a reason
  (criterion 4). Adopted from provider notice `notice-conform-vs-remap.md`;
  reply filed as `adopt-conform-vs-remap.md`.
- **Why:** `/transform` currently exposes only conform (proximity). The engine has
  shipped `remap_by_degree` — degree→degree translation, bijective on in-scale
  material, walks survive by construction — and `modal_transform` for clips that
  may contain key changes (builds per-area maps; leaves channel-10 drums alone).
  Without remap, every "change the mode" request routes into a lossy snap.
- **Scope:** `bridge/server.py` (`/transform` gains ops `remap_by_degree` and
  `modal_transform`), `bridge/test_bridge.py`, `./verify` contract check.
- **Acceptance criteria:**
  1. ✅ `op: "remap_by_degree"` with `sourceScale`/`sourceRoot`/`targetScale`/
     `targetRoot` returns `{notes, report}` in the established shape (report
     carries `edits`, `map`, `notes_diatonic`/`notes_chromatic`; `events` popped
     into `notes`).
  2. ✅ **Unequal cardinality is surfaced, not swallowed.** The engine refuses with a
     legible `ValueError` ("no canonical degree correspondence between unequal
     cardinalities"); the bridge maps that to a 4xx carrying the engine's own
     reason string, and the consumer shows it as a UI state offering conform as
     the alternative. Pin this in a test — the refusal is a feature.
  3. ✅ Walk-preservation pinned both ways: `G F E D C` → C Natural Minor keeps
     5 distinct pitches via remap (`G F D♯ D C`) and merges via conform
     (`G F F D C`) — the contrast is a test, so a change in either semantics
     breaks the build rather than the user's clip.
  4. ✅ `modal_transform` **explicitly deferred**, returning 501 with its reason:
     its result is `{plan, application}` with per-note pairing in
     `plan.decisions` rather than the flat `edits` list conform and remap share,
     plus a chromatic-policy surface (`rhetoric`/`strict`) needing UI decisions.
     Wiring it half-way would give the workshop a second, inconsistent diff shape.
- **Human gate:** granted in session 2026-08-11 ("Let's see it") for the
  `/transform` contract addition.
- **Resolved on contact:** the anticipated adapter was unnecessary. The MCP
  wrapper takes `events: list[list]`, but `mts.generate.remap.remap_by_degree`
  takes a **`Sequence`** exactly like conform, so the bridge calls the generate
  layer and reuses `_sequence_from_payload` unchanged.

### Q-011 — Auto-start the bridge from the extension
- **Status:** done 2026-08-15 (trace: traces/2026-08-15-q011-autostart.md).
  **Verified in Live with the bridge deliberately down:** Analyze produced a
  real result (C major, margin 0.27) instead of an error; exactly one bridge
  process afterwards, and a second command reused it (same PID, no duplicate).
- **Lifecycle ruling (criterion 4): DETACHED**, for two verified reasons — the
  SDK exposes no deactivate hook (`ExtensionContext` is exactly
  application/commands/environment/resources/ui), so reap-on-deactivate is not
  available; and idempotence (spawn only when nothing answers `/health`) makes
  a bridge that outlives Live *reused*, not duplicated. Same as starting it by
  hand, minus the hand.
- **Config lives in `environment.storageDirectory/bridge-launch.json`** — the
  host-provided writable dir — set once via "Tonality: Set up bridge
  auto-start…". Nothing in a tracked file; no `.env` involvement.
- **Sandbox finding (load-bearing, cost one failed live run):** the host runs
  Node under `--permission --allow-fs-read=<Extensions dirs>`. That restricts
  what *Node* may read, not what a spawned *child* may open. So `spawn` of a
  python in `~/Documents` works — but an `existsSync()` pre-flight on that same
  path throws "Access to this API has been restricted", which masqueraded as a
  config error. Removed the pre-flight; a wrong path now surfaces through
  spawn's own ENOENT. See LIBRARY L0009.
- **Why:** the only manual step left between "right-click a clip" and "it works"
  is starting `bridge/server.py` by hand. The Extension Host is a full Node
  runtime, so the extension can spawn it. The new engine indicator (56fbe7f)
  makes the come-up visible.
- **Scope:** `extension/src/` (spawn + readiness wait), `.env` (venv python path
  + `TONALITY_REPO` — machine-local, gitignored), README.
- **Acceptance criteria (all ✅ — unit-tested AND verified in Live):**
  1. If `/health` fails on any command, the extension spawns the bridge with the
     configured interpreter, waits for `/health` (bounded, e.g. 10s), then
     proceeds; failure to come up shows the "start the bridge" message with the
     command — never a silent hang.
  2. Never spawns a second bridge if one is already answering.
  3. Interpreter path comes from config, never hardcoded (rule: no machine
     identity in tracked files); a missing config degrades to today's message.
  4. Spawned process is detached from the extension's lifetime OR cleanly reaped
     on `deactivate` — decide and document; a zombie bridge on every Live restart
     is worse than the manual step.
- **Out of scope:** installing the Tonality venv; that stays a README step.

### Q-012 — "Repair / clean up" transformation (ruleset-based)
- **Status:** open, ready. Human-selected 2026-08-15.
- **Engine surface (verified 2026-08-15):** `mts/search/repair.py:162`
  `repair_sequence(sequence, ruleset, *, max_edits≤6, pitch_window, allowed_pcs,
  max_evaluations, max_repairs) -> RepairResult` — minimal re-pitch edits making
  the sequence satisfy a ruleset's hard rules. Rule families shipped: `harmony`,
  `melody`, `voice_motion`. Takes a `Sequence` like conform/remap.
- **Why:** first *rule*-based op in the workshop, distinct from scale ops: "fix
  awkward leaps / forbidden parallels" rather than "make it Dorian". Tonality
  called a cleanup surface "a thin layer over shipped machinery"
  (response-recommendations.md).
- **Scope:** `bridge/server.py` (`op:"repair"` on `/transform`, ruleset from a
  new `GET /rulesets` served from the engine — never hardcoded), workshop row +
  params (ruleset picker, `max_edits`), tests, `verify` contract check.
- **Acceptance criteria:**
  1. `/transform op=repair` returns `{notes, report}` in the established shape,
     with the engine's `RepairResult` passed through (which rules were violated,
     which edits fixed them).
  2. `allowed_pcs` is wired to the persistent Scale control so repair can be
     constrained to the chosen scale — composition, not new theory.
  3. The workshop shows *which rule* each edit satisfied.
  4. "No repair found within `max_edits`" is a first-class state, not an error.
- **Human gate at implementation:** `/transform` contract addition (protected).

### Q-013 — Next-chord suggestions panel
- **Status:** open, ready. Human-selected 2026-08-15. **The shipped half of
  Q-009** — no Wend needed for the suggestion itself.
- **Engine surface (verified):** `mts/analysis/succession.py:295`
  `recommend_next_chord(current=(root_pc, quality), *, tonic_pc, mode, history,
  qualities, weights_version, vl_neighbours, vl_max_distance) ->
  NextChordRecommendation`. Ranked, margined, deterministic; `weights_version`
  is the citable versioned prior their Ruling 1 describes.
- **Scope:** `bridge/server.py` (`POST /recommend/next-chord`, fed from the
  clip's last analysed chord + detected key), workshop panel, tests.
- **Acceptance criteria:**
  1. Panel lists ranked candidates **with margins and evidence**, never a single
     collapsed answer (rule 7; their Decision 7).
  2. Shows the `weights_version` used, so a suggestion is reproducible later.
  3. Clicking a candidate auditions it (Web Audio) appended after the clip.
  4. Optional: "append as a placeholder chord" writes one bar — the simplest
     possible Q-009 realisation, no generator involved.
- **Note:** this is Tonality's own recommender, so it stays deterministic
  end-to-end by their guarantee; nothing to pin on our side beyond not adding
  a model in front of it.

### Q-014 — A/B loop audition + chord-strip interaction
- **Status:** done 2026-08-15 (trace: traces/2026-08-15-q014-loop-audition.md).
  Pure UI, no engine work — as scoped.
- **How criterion 1 was met:** replaced one-shot scheduling with a **lookahead
  scheduler** (200ms window, 40ms tick) that re-reads the current source each
  pass. Notes are committed only just before they sound, so a Before/After
  toggle takes effect at the next note rather than the next pass, and looping
  needs no gap. Verified programmatically: toggling mid-play keeps the same
  `AudioContext` and the same `cycleStart` — it does not restart.
- **Chord tails are absorbed into the preceding chord's audition range.** The
  engine reports single-pitch tails as the last note of a chord decays (4 of 12
  segments on the demo clip); clicking one looped 0.2 of a beat. Tails now
  render greyed but are not click targets, and a chord's range runs to the next
  *real* chord — `C maj7` auditions [1,2), not [1,1.8).
- **Acceptance criteria:**
  1. Loop mode: the clip loops in Web Audio and a Before/After toggle switches
     the material *while playing*, seamlessly at the next beat boundary. This is
     how a transformation is actually judged.
  2. Click a chord segment (before *or* after strip) to audition only that
     stretch; hover highlights its member notes in the roll.
  3. Playhead and loop region drawn on the roll.
- **Out of scope:** any engine call.

### Q-015 — Selection-scoped transforms
- **Status:** open. Human-selected 2026-08-15.
- **Intent:** apply a transformation to a beat range (dragged on the roll or
  typed) instead of the whole clip; notes outside the range pass through
  untouched.
- **Design note:** engine calls are unchanged — the consumer splits the note
  set, transforms the in-range subset, and merges. Pairing (L0006) must be done
  on the subset only. Analysis-only mode should still show the whole clip.
- **Acceptance criteria:** range selection UI; out-of-range notes byte-identical
  after render; report counts reflect the subset; undo is still one step.

### Q-016 — Pin notes
- **Status:** open. Human-selected 2026-08-15.
- **Intent:** lock chosen notes so any transform leaves them untouched (a
  bass note you like, a deliberate blue note).
- **Design note:** consumer-side exclusion — pinned notes are removed from the
  request and re-inserted after. **Care:** for remap this can break the walk
  the engine would otherwise preserve, and for conform it can leave a collision
  the engine never saw. Show pinned notes distinctly and count them in the report.
- **Acceptance criteria:** click-to-pin in the roll; pinned notes never appear
  in `edits`; a pinned note that would have collided is reported.

### Q-017 — Transformation stacking (in-dialog pipeline)
- **Status:** open. Human-selected 2026-08-15. **Largest of the batch.**
- **Intent:** apply an op, then transform the *result*, with an in-dialog
  history you can step back through — the workshop becomes a small pipeline
  rather than "pick one op".
- **Design note:** today every change recomputes from the original clip, which
  is what keeps the before/after view honest. Stacking needs an explicit stage
  list, with "before" meaning *previous stage* and a way to view the cumulative
  diff. The fold-chromatics toggle is already a two-stage pipeline in disguise
  (remap→conform), so it should become the first stacked example rather than a
  special case. Render commits the whole stack as one undo step.
- **Acceptance criteria:** stage list with add/remove/reorder; per-stage and
  cumulative diff; the current fold toggle expressed as two stages; one undo.

### Q-018 — Recommendations UI against Tonality's gap-32 contract
- **Status:** open, **buildable now against a stated contract**, though the
  endpoint itself is unscheduled upstream. Human-selected 2026-08-15.
- **Contract (their response-recommendations.md):** ranked list with margins,
  per-candidate evidence, **a plan handle per row**; recommendations arrive
  from a *dedicated* endpoint (never mixed into `/analyze`) and reference plan
  artifacts, so accept = `inspect plan → apply plan`.
- **What we can do before the endpoint exists:** build the panel against a
  fixture that matches the contract, and drive it from Q-013's
  `recommend_next_chord` as the first live producer (it already returns ranked,
  margined candidates). When gap 32 ships, swap the producer.
- **Boundary reminder:** enumeration/evidence/ranking are the engine's; we own
  dropdowns, presentation, audition, accept. Never a collapsed "best".
- **Acceptance criteria:** panel renders a ranked list from the fixture and
  from Q-013 live; each row shows margin + evidence; accept applies via the
  established render path; nothing model-generated anywhere in the flow.

### Q-010 — "Voice leading" transform with options (blocked upstream)
- **Status:** open, **blocked on the provider** — this is `revoice`, which
  Tonality deferred to their Phase 7 proper (their ROADMAP ~3758; our
  `/transform` already answers a visible **501** for `op:"revoice"`, so the seam
  exists and nothing needs inventing here).
- **Intent (human, 2026-08-11):** a transform that re-voices the clip, with a
  number of options.
- **What already exists upstream, as separate primitives** (recon 2026-08-11):
  - `segment_to_chords` — what chords are in this clip (temporal/harmonic_segmentation.py)
  - `suggest_voicings(chord) -> VoicingSet` — candidate voicings (analysis/voicings.py)
  - `voice_leading` / `voice_leading_realized` — **measure** motion between
    voicings (analysis/voice_leading.py); `voice_leading_distance` as an MCP tool
  - `voice_leading_policies()` — VL conventions exported as **named, versioned
    policy ids** (`POLICY_DOUBLING_V1`) precisely because they are "a named
    choice, not a fact"
  So the ingredients are analysis-side and present; what is missing is the
  composed **generative** step — choose voicings across a succession to minimise
  motion, then place registers. That is exactly why they called it a project
  rather than a slice.
- **The "options" the human wants are the design questions the provider already
  raised and explicitly could not answer for us** (response.md Ruling 6): what
  does re-voicing a *melodic* clip mean versus a chordal one; keep or drop the
  bass; re-voice **toward a target progression** or merely **smooth the existing
  one**. Add the obvious knobs: register span, open/close voicing, doubling.
  **These are the human's calls, not ours and not the engine's** — and answering
  them is the prerequisite for a useful brief.
- **Model the options the way the engine already models VL conventions:** named,
  versioned, and cited in the result, so a rendered re-voicing is reproducible
  and a later engine upgrade cannot silently change what a saved choice meant.
- **Ours vs theirs:** ours = presenting the options, auditioning candidates,
  applying the chosen one in one undo step. Theirs = every voicing decision.
  Do **not** implement voicing selection here.
- **Next step:** when the human answers the three questions above, file them on
  the existing revoice thread. Nothing to build in this repo until then.

### Q-008 — Declared vs detected scale, and chromatic *character* in remaps
- **Status:** open, not started. Two related asks from the human (2026-08-10).
- **(a) Declared-vs-detected comparison.** Compare Live's *declared* clip/song
  scale (`song.rootNote` / `scaleName` / `scaleMode`) against the engine's
  *detected* key from `/analyze`, and show agreement or disagreement. The
  disagreement is the interesting signal — a clip declared C major that analyses
  as A minor, or one whose declared scale was never updated after an edit.
  The workshop already has both readings specced as separate reference sources
  (Q-004); this item is surfacing the *comparison* as a first-class readout.
  **Needs:** the extension to pass Live's declared scale into the workshop
  session (the page cannot reach the SDK), plus `/analyze` returning the detected
  key's **degrees** rather than only `{name, score, margin}`.
- **(b) Preserve chromatic character through transforms.** A toggle to treat
  out-of-scale notes as *tonicizations / transition tones / chromatic colour* and
  keep that character through a remap, instead of folding them into the target.
  **Do not build this here** — it is theory, and the engine already models it:
  `RemapEdit` carries `degree`, `alteration`, `tied_attachment` and
  `attachment_note`; `RemapResult` carries `absorbed_alterations`; and
  `modal_transform` takes a **`chromatic` policy** (`"rhetoric"` vs `"strict"`)
  which appears to be exactly this switch. So (b) most likely = wiring
  `modal_transform` (deferred in Q-007) and exposing its policy, NOT new logic.
  **Verify that reading with the provider before scoping.**
- **Open question:** does "preserve character" mean *don't move it* (leave the
  chromatic tone where it is) or *move it so it keeps the same relationship to
  the new scale*? These differ audibly, and the answer is the human's, not ours.

### Q-009 — Recommend key changes and transition chords; optional generated example
- **Status:** open, not started. Human ask (2026-08-10). Sibling of Q-006 and
  probably wants filing alongside it.
- **Intent:** recommend key changes and transition chords to *follow* the current
  clip — what comes next, rather than what to fix in place — with an option to
  generate a placeholder example demonstrating the suggestion.
- **The generator already exists and is not ours:**
  `~/Documents/Claude/synthetic-worlds/wend` (github.com/Lifted-Truck/Wend) is a
  "conditional generative sequencer" whose README lists **pivot modulation** and
  **secondary-dominant tonicization** among its primitives, driven by a rule DSL,
  emitting MIDI plus a decision trace — and it already takes its theory from
  Tonality "through a single oracle seam". It also has a `--serve` playground, so
  it has a server mode to talk to.
- **Boundary reading:** the *recommendation* ("modulate to the relative minor via
  this pivot") is theory → Tonality (same argument as Q-006). The *realization*
  (an actual 4-bar example) is generation → Wend. Tonality-Live is the third
  party that displays and auditions the result. So this is a **two-provider**
  integration and needs briefs to both, not code here.
- **Do not** reimplement pivot selection or example generation in this repo.

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
  extensions, generative-side; `revoice` is deferred to Phase 7 (their Ruling 6).
  **CORRECTED 2026-08-11 by the provider (response-recommendations.md), two
  claims of ours were wrong:**
  - `pivots_between` is **not an engine tool** — it is *Wend's* function, rebased
    onto the engine's `search_identities` (576/576 parity). Pivot enumeration as
    an engine surface, and modulation-path planning, remain Phase 7 and **unbuilt**.
  - "Clean up harmony" is **not unscoped**: mechanically it is `repair_sequence`
    (impose a ruleset with minimal edits), shipped today for the voice-motion and
    melody rule families; harmony-family repair is their recorded slice 2. A
    cleanup *recommendation* only adds "which ruleset, and is the piece far
    enough from conformance to be worth proposing" — a thin layer over shipped
    machinery, not new work.
  - "Complexify" **is** genuinely new, as we guessed — and the furthest away.
- **Ours vs theirs:** ours = the context dropdowns, presenting ranked
  recommendations, and applying the chosen one. Theirs = every judgment that
  produces a recommendation.
- **ANSWERED 2026-08-11** (`response-recommendations.md`, ball: none). Both
  rulings given, work unscheduled; recorded upstream as their gap 32 with
  **Tonality-Live named as the consumer**, so we may build UI against the
  contract whenever we like:
  - **Ruling 1 — the engine owns it**, because it already ships one:
    `recommend_next_chord` defines the register. Their definition, worth keeping
    verbatim: *"a recommendation is analysis pointed at possibility — a
    deterministic enumeration of applicable transformations, each grounded in a
    measured fact about the material, ranked under a citable versioned prior,
    delivered plural-with-margins."* Engine owns enumeration + evidence +
    ranking; **we** own dropdowns, presentation, audition, accept; uncited taste
    belongs to their learned sibling, not to either of us.
  - **Ruling 2 — its own endpoint, not an enrichment of `/analyze`.** Analysis
    results are *measurements*; a recommendation is a *proposal*, and mixing them
    in one payload is exactly the facts/proposals blur we asked to have pinned —
    so it is pinned by transport rather than convention. Recommendations
    reference **plan artifacts**, making audition-and-accept literally
    `inspect plan → apply plan`. They also went further than our ask on the AI
    boundary: we pinned "nothing model-generated in the note pipeline"; they pin
    "the engine's recommender is deterministic end-to-end — no model calls exist
    in `mts` and none will."
  - **Genre priors: ruled, and the way we hoped.** They do not ship without a
    citable source or licence-compatible corpus. Three tiers: measurement ·
    genre/instrument *affinity* as a cited, plural, versioned, falsifiable prior
    (gated on finding a source worth pinning) · uncited taste, which is the
    learned sibling's. *"Jazz wants ♭9s ships when it can cite something, and
    not before."*
  - **UI contract when we build it:** ranked list with margins, per-candidate
    evidence, a plan handle per row.
- **Brief filed 2026-08-10** at the human's request:
  `~/Documents/Tonality/integrations/Tonality-Live/brief-recommendations.md`
  (`tonality-live-003`, kind: early-signal, ball: provider, respond-by
  2026-09-14). Explicitly *not* a request for work — nothing here is blocked on
  it; it exists so Phase 7 can be shaped with this in view. Asks two things:
  does a recommendation surface belong in the engine at all (vs. richer analysis
  + consumer-side "therefore suggest X"), and if so, own endpoint or an
  enrichment of the analysis result.

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
