# workshop-feedback — three rounds of human feedback on the prototype

- **Queue item:** Q-004 (in progress). Follows traces/2026-08-11-workshop-prototype.md.
- **Round 2:** in-scale count shown; scale dropdown annotated with each scale's
  note count and wrong-cardinality targets marked red with ✕ (19 of 37 for a
  7-note source) so the constraint is visible *before* the refusal; Root/Scale
  made one persistent control shared by every mode; "use detected key as source"
  toggle; "Constrain to this scale instead" button on the refusal.
  - The reference dropdown had said "Target scale (below)" while the target scale
    sat *above* it. Removed positional wording entirely rather than correcting it
    — it goes stale on the next layout change.
  - Also stopped rebuilding the selects on every change; that had been silently
    discarding focus and scroll position mid-list.
- **A question answered with measurement, not opinion.** The human asked whether
  purple (out-of-scale) notes persisting after a transform was a bug. Measured
  against the engine: before 6 of 20 outside C Dorian; after **conform** 0; after
  **remap** 2, with the engine independently reporting `notes_diatonic=18,
  notes_chromatic=2`. It is correct — conform flattens into the scale, remap is
  degree-preserving so chromatic tones keep their alteration. The behaviour was
  right and the *label* was wrong; remap leftovers now read "chromatic (kept by
  design)" with a tooltip. This is Q-008(b) already working.
- **Round 3:** keyboard gutter (every lane named, in-scale lanes lit, so a scale
  reads off the left edge); a second chord strip naming the *transformed*
  material via `/analyze` (C Ionian → C Dorian gives `C maj → C min`,
  `A min → A dim`, `G maj → G min`); "fold chromatic tones into the scale" as a
  Translate toggle.
- **The fold toggle needed engine recon, and the answer shaped it:**
  `remap_by_degree` takes **no** chromatic option (preserving character is
  inherent to degree mapping) and `modal_transform`'s policies are
  `("rhetoric", "strict")` — strict *refuses* on ambiguity rather than folding.
  So there is no native "don't retain" switch. Implemented as a **composition of
  two engine calls** (remap, then conform the leftovers), labelled in the UI as
  "two engine steps — not a single blessed operation" so nobody mistakes it for
  an engine-blessed primitive. Verified: fold off → 4 moved, 2 chromatic kept;
  fold on → 6 moved, 2 folded in, **0** left outside, and the resulting chords
  clean up (`A minmaj7`/`?` → `A dim`, `G minmaj7` → `G min7`).
- **Bug found while checking the keyboard:** in-scale lanes did not light in
  Translate mode. `ConformResult` carries `degrees`; **`RemapResult` does not**
  (it carries `map`). Centralised into `shadedDegrees()`, which falls back to the
  engine catalog's degrees for the chosen scale offset by the root — engine data,
  arithmetic only.
- **Verify:** `./verify full` exit 0 against a live bridge (27 bridge tests;
  /health + /analyze + /transform conform, remap, refusal).
- **Open questions:** is composing remap→conform the blessed idiom for folding,
  or should the engine expose it natively? Worth raising in the Q-008(b)
  conversation rather than as a new brief. The workshop page still has no
  automated tests. Extension side still unwired.
