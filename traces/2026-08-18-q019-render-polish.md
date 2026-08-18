# q019-render-polish — the playhead was skewed, and clips now say what key they are in

Two human-reported items, one branch. First work on a PR workflow rather than
direct commits to main.

## Playhead

Reported as "starts inside the piano section instead of to the right of it".
That was the visible half. The playhead is the only overlay that is a DOM
element rather than canvas drawing, so it is the only one that has to reproduce
the canvas's `bx()` mapping by hand — and it used `left: frac*100%`, a
percentage of `.rollwrap`, which spans the keyboard gutter as well as the roll.

So the error was a **skew, not an offset**. Measured in the running page:

| beat frac | old x | correct x | error |
|---|---|---|---|
| 0    | 0      | 56     | 56px into the keys |
| 0.25 | 260.5  | 302.5  | 42px early |
| 0.5  | 521    | 549    | 28px early |
| 1    | 1042   | 1042   | correct |

Worst at the start, vanishing at the end — which is why it read as "starts in
the wrong place" rather than "is wrong everywhere".

Fixed with `calc(var(--gutter) + frac * (100% - var(--gutter)))`: the same
variable the chord strips already align to, so the roll, the strips and the
playhead agree by construction instead of by three separate arithmetic. Verified
against the canvas's own `bx()` at four points, all within 0.6px.

Also corrected a stale `var(--gutter,92px)` fallback on `.striplabel` to the 56px
the canvas actually reserves — dead today because `draw()` sets the variable at
boot, wrong the moment anything renders before it.

## Key in the clip name

Append the resulting key, or replace one already stated last in the name, so
repeated renders leave one key rather than a growing tail.

**The design question was where the scale vocabulary lives.** To notice that
"Verse C major" ends in a key, something must know that "major" is a scale word
— and a scale table in this repo is exactly what §Domain forbids. Resolved by
passing the vocabulary in: the page sends the engine's 37 catalog names plus the
mode word its analysis emitted (`major`/`minor` are not catalog entries, so this
is load-bearing, not belt-and-braces). `nameWithKey` knows no scale names at
all; with an empty vocabulary it degrades to a plain append.

**The label differs by operation, and testing is what settled it.** Conform and
remap declare a target; transpose does not. My first instinct was to use the
engine's read-back everywhere, since asking the engine is usually the right
move here. Measured instead: a C-Dorian remap analyses back as **"F major"**,
the relative Ionian. Using detection everywhere would have renamed the clip to
the wrong mode immediately after the user explicitly chose Dorian. So the
declared target wins where there is one, and detection covers transpose, where
it is the only answer available.

The name is computed *outside* `withinTransaction` and assigned *inside* it, so
the transaction holds only the two assignments and one Cmd+Z takes back the
notes and the name together.

## Evidence

- `./verify full` exit 0 against a live bridge (mts 0.1.0): 24 extension tests
  (11 new), 34 bridge tests, `/health` + `/analyze` + `/transform` contracts.
- Playhead mapping asserted against `bx()` in the live page at 4 points.
- The page's *actual* render payload (label + 38-word vocab, captured from the
  running page) replayed through the real `nameWithKey`, including the catalog
  names carrying regex metacharacters — `Super Locrian (Altered)`,
  `Melodic Minor (asc.)`, `Dorian #4`. All correct and idempotent.

## Open

`clip.name` is declared settable on the SDK's `Clip` and typechecks, but the
assignment has **not** been exercised inside a running Live — the standing gap
(no automated in-Live harness) applies, and this is the one link in the chain
verified by declaration rather than by running it.
