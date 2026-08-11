# conform-vs-remap — adopt the provider's routing; correct a same-day design error

- **Queue item:** Q-004 (design correction) + new Q-007 (wire remap into
  `/transform`). Also closes the `tonality-live-002` order-contract thread.
- **Why:** provider filed `notice-conform-vs-remap.md` after the human reported a
  destroyed scale walk during the in-Live test runs. It is a routing
  recommendation, not a code change, with ball on the consumer.
- **Evidence consulted (verified before adopting, not taken on description):**
  - `mts/generate/remap.py:252` + `mts/mcp/tools.py:1694` — `remap_by_degree`
    exists; its docstring calls itself "the OPPOSITE of conform_to_scale".
  - `mts/temporal/sequence.py:90` —
    `sorted(events, key=lambda e: (e.onset, e.pitch.midi))`, confirming their
    correction that wire order dies at *ingestion*, not in conform's assembly.
    My guessed mechanism in brief-note-order was wrong; I had labelled it a guess.
  - Ran the walk case directly: `G F E D C` → C Natural Minor. conform returns
    `G F F D C` (4 distinct of 5 — destroyed at EQUAL cardinality); remap returns
    `G F D♯ D C` (5 distinct, intact); remap → Minor Pentatonic raises
    `ValueError` naming unequal cardinality.
- **The error this caught (the useful part):** earlier the same day I verified
  `fit_to_key` ≡ `conform_to_scale` (byte-identical notes and edits) and told the
  human so — correct — then concluded the workshop should expose ONE root+scale
  control. Wrong. That control would route "make this Dorian" (translation) into a
  proximity snap. The equivalence is real; the inference was not. The two tools
  are separated by *user intent*, which neither signature reveals. Nothing had
  shipped; the notice arrived first.
- **What changed:** ROADMAP Q-004 gains an explicit CORRECTION block plus the
  intent table and the walk evidence; new Q-007 (remap + modal_transform on
  `/transform`, with the unequal-cardinality refusal pinned as a *feature* and a
  walk-preservation test); LIBRARY L0007 + INDEX; L0006 evidence sharpened with
  the real mechanism. Filed `adopt-conform-vs-remap.md` on the channel.
- **Alternatives rejected:** push back and keep one scale control with a
  heuristic ("translate if cardinalities match, else conform") — rejected: it
  guesses intent, and guessing intent is what the notice warns against. Also
  rejected: implementing remap in the bridge/extension — it is theory, and it
  already exists upstream.
- **Verify:** `./verify fast` exit 0. No source changed in this pass (docs +
  exchange only); Q-007 carries the code work.
- **Open questions:** unequal-cardinality span policy is the provider's gap
  31(b)/(c), pending their triage of `tonality-live-003`. From here what we want
  is the refusal plus ranked options with costs, not a chosen default.
