# transpose-input-fix — a typed "1" became 10 semitones

- **Queue item:** Q-005.
- **Why:** user reported "transposition of 1 moves way further than a semitone."
- **Diagnosis (what it was NOT, with evidence):** `transpose()` is correct.
  Measured in Live against the C3 label at ~6.2 px/semitone: input `1` moved all
  three test notes (60, 64, 55) exactly one row; input `2` moved them exactly two.
  The Enter path applies once (no double-send), and a second invocation showed a
  fresh dialog rather than consuming a stale queued reply — both hypotheses I
  raised and then ruled out.
- **What it was:** `extension/ui/transpose.html` shipped the field as
  `<input type="number" value="0">`. Clicking into the field puts the caret
  wherever the click lands — before the `0` if you click its left half — so a
  typed `1` becomes `10`. Confirmed directly in Live: typed a single `1`, field
  read `10`. `parseInt("10") === 10`, so the clip moved a minor 7th. Nothing on
  screen looks wrong, which is why it reads as "transpose is broken".
- **Fix:** ship the field empty with `placeholder="0"` — with no pre-filled digit
  there is nothing to prepend to. Empty parses to NaN, which the existing
  `Number.isFinite(v) ? v : null` guard already treats as "no change".
- **Alternatives rejected:** select-the-contents-on-focus (a click's mouseup can
  collapse the selection again, so it only *usually* works); clamping the input
  range (would mask the real problem — the value was genuinely 10).
- **Verify:** `./verify fast` green. Fix confirmed by DOM check in a browser:
  initial value `""`, placeholder `0`, and prepending `1` at caret-start yields
  `"1"` → `parseInt` 1. NOT yet re-verified inside Live (would need a rebuild +
  reinstall + Live restart); the defect and its mechanism were both demonstrated
  in Live before the change, and the fix removes the mechanism.
- **Open questions:** dialog input handling still has no automated coverage — the
  logic is inline JS inside HTML and unreachable from node:test. Q-004 (workshop
  GUI) may replace this dialog entirely, which would make a test harness for it
  worth building once rather than twice.
