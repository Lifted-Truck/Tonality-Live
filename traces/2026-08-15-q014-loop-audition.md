# q014-loop-audition — A/B while it plays, and clickable chords

- **Queue item:** Q-014. Pure UI; no engine call added, as scoped.
- **The design decision that made criterion 1 possible.** The old audio path
  scheduled every note up front, so switching source could only ever mean
  "stop and restart" — which is exactly the thing that makes a transformation
  hard to judge. Replaced it with a **lookahead scheduler**: a 40ms interval
  commits only what falls inside the next 200ms, re-reading `sourceNotes()`
  each pass. Consequences: toggling Before/After swaps material at the next
  note with the clock untouched, and looping wraps without a gap because the
  wrap is just another scheduling decision.
- **Verified programmatically, not by ear** (the thing a screenshot cannot
  show): after `play("before")` then `play("after")`, the `AudioContext` is
  the same object and `cycleStart` is unchanged — proof it did not restart —
  while `playing` flipped and the button states followed.
- **A flaw the test found, not the design.** Clicking a chord segment worked,
  but the first one I clicked was a *trivial* single-pitch tail — the engine
  reports one as each chord decays (4 of 12 on the demo clip) — giving a
  0.2-beat loop. Tails now render greyed with `pointer-events: none`, and a
  chord's audition range extends through any following tails to the next real
  chord. `C maj7` now auditions [1,2) rather than [1,1.8).
- **Two ordering bugs found by testing, both mine.** (1) `stopAll()` did not
  clear the segment's "playing" mark, so a stopped segment stayed lit. (2)
  Fixing that broke the mark entirely, because the click handler set the class
  *before* calling `play()`, which calls `stopAll()` — wiping it immediately.
  The mark is now set after playback actually starts, and only if it did.
  Verified: exactly one segment lit at a time, following the click, cleared on
  stop.
- **Criterion 3:** the audible region and the hovered segment are drawn as
  bands on the roll (orange = looping now, blue = hover), sharing one painter
  since both are beat ranges; hovered member notes get a blue outline.
- **Verify:** `./verify fast` exit 0 (22 extension tests + py_compile). The
  workshop page still has no automated coverage — its logic is inline JS, the
  standing gap noted since the prototype; everything above was verified by
  driving the live page and asserting on its state.
- **Open questions:** the loop currently restarts its cycle when you switch
  *region* (clicking a different chord), which is correct, but switching
  Before/After while auditioning a region keeps the region — worth confirming
  that is what a user expects once it has had real use.
