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

## Round 3b — the keyboard was rendering distorted

- **Symptom (human, with a screenshot):** "formatting is a little messed up" —
  key labels squashed and the keyboard column shrinking with the window.
- **Cause:** the canvas had a fixed backing store (`width="1600" height="620"`)
  stretched by CSS to fill a variable container. Horizontal and vertical scale
  factors therefore differed, distorting glyphs, and `GUTTER` being expressed in
  *canvas* pixels meant the keyboard's on-screen width shrank as the window
  narrowed — at 505px wide it was ~29 CSS px, far too narrow for "C#4".
- **Fix:** size the backing store to the element's real displayed size × DPR and
  `setTransform(dpr,…)`, so all drawing is in CSS pixels. `GUTTER` is now 56 CSS
  px — constant on screen — and the CSS `--gutter` var is simply that number, so
  the chord-strip label column and the drawn keyboard cannot drift apart.
  Verified: backing 1010×1248 for a 505×624 element at DPR 2 → scaleX 2.000,
  scaleY 1.999, uniform.
- **Also corrected while there:** white keys were being drawn dark grey
  (`#4a4a4a`), which inverted the one visual convention a keyboard has. Now
  ordinary white keys are light (`#9d9a94`), black keys dark (`#232323`), and
  the accent tint means "in the scale" — so the tint reads as information rather
  than as the key's identity. Ink flipped to match (dark on light keys, light on
  dark ones).

## Round 4 — tonic highlighting

- Tonic lanes and keys now read distinctly from other in-scale ones: the key
  wears the accent itself (other in-scale keys stay tan), its name is bold, and
  the lane carries a stronger tint across the roll.
- `shadedRoot()` deliberately mirrors `shadedDegrees()`'s source — target root
  for conform/remap, the detected key's tonic when the display reference is the
  detected key. If the two ever disagree the highlight would be lying about
  which collection is being shown, so they are written to move together.
- Verified it follows the root rather than assuming C: switching the root to G
  gives `shadedRoot()` = 7 and degrees `[7,9,10,0,2,4,5]` = G Dorian.
