# DECISIONS — Tonality-Live

Append-only record of ratified decisions. Newest first. ROADMAP.md holds
direction; this file holds *what was settled and why*, so it is not
re-litigated. Each entry links to a trace where one exists.

## D8 — 2026-08-18 — Vendor the kit-owned gates; adopt the leak gate this repo never had

- **Decision:** source `record`, `leak_gate`, and `kit_integrity` from the
  vendored, sha256-pinned `.kit/kit-gates.sh` (kit 2.4.0) instead of carrying
  copies. `./verify` stays project-owned; `.kit/` is machine-owned and any edit
  to it turns the oracle red by design.
- **What this repo actually had: no leak gate at all.** Not a drifted copy — a
  hole. `git log -S'leak_gate' -- verify` returns nothing, so no version of this
  oracle ever checked for machine-absolute paths, across every commit since the
  retrofit. The fleet audit (2026-08-18) predicted drifted copies; here the
  finding is worse and simpler.
- **`.kit/` was already sitting in the tree, untracked and unsourced** — an
  earlier sync had installed the mechanism and nothing had wired it. A
  checksum-perfect copy that `verify` never sources is indistinguishable from no
  gate at all, which is exactly why "reachable" is proved separately from
  "present".
- **Our `record()` was byte-identical to the kit's**, so deleting it lost
  nothing; it was the kit's copy, adapted only by having been copied.
- **Missing `.kit/` is a hard exit, not a degraded run.** This is deliberately
  the opposite of how this repo treats an absent Tonality engine (skip with a
  printed notice, INTEGRATIONS rule 2). Those are different classes: a missing
  provider means *cannot check*; a missing privacy gate means *not checking*,
  and only the second can ship a leak while reading green.
- **Kit gates accumulate into `ok`** rather than early-returning, so a leak and
  a broken typecheck are reported in the same run; the project gates keep their
  early return, since a failed typecheck makes the tests after it meaningless.
- **Proved fired, not just present:** a planted home-absolute path (the
  `/Users/<name>/…` shape, written here with a placeholder on purpose) in an
  *untracked* file is caught — `--untracked` doing its job — and takes
  `./verify fast` to exit 1. Writing the literal instead cost one red run: the
  gate caught this very entry, which is the gate working, not a false positive.
  Prose examples take the placeholder form; no allowlist entry was added,
  because an exemption on the decision log would have been a permanent hole
  bought to save one edit.

## D7 — 2026-08-09 — Wire the conform family; two new public commands; `GET /scales`

- **Decision:** With the engine's conform family shipped (their PR #259), take
  `/transform` from 501 to live and expose it in Live. Human-gated items
  approved in session before writing: **two new public command IDs**
  (`tonality.fitToKey`, `tonality.conformToScale`) and the `/transform` HTTP
  contract — both §Domain protected paths.
- **Wire:** request `{op, notes, bpm?, tieBreak?}` plus `tonicPc`/`mode`
  (fit_to_key) or `rootPc`/`scale` (conform_to_scale); response
  `{notes, report}` where `notes` is `NoteDescription`-shaped and `report` is
  the engine's `ConformResult` minus `events`, passed through **unreshaped** so
  the bridge stays glue.
- **`GET /scales` added** (beyond the brief): the picker needs the engine's 37
  scales, and a hardcoded TypeScript copy would silently drift when the engine
  adds one. Serving it keeps one source of truth.
- **Collisions — dedupe here, and say so.** The engine ruled keep-and-report and
  deliberately left the survivor choice to the consumer. `dedupeCollisions`
  drops merged duplicates keeping **first in clip order** — arbitrary but
  deterministic, and it asserts nothing about which note was better (the exact
  judgment the engine declined). Only slots the engine *reported* are touched;
  pre-existing duplicates are left alone. The count is reported in the dialog.
- **Invariant held:** no snapping logic here. Every musical decision — nearest
  member, tie resolution, what counts as a collision — is the engine's.
- **Evidence:** `./verify full` green end-to-end against a live bridge (13
  extension + 19 bridge tests; `/health` + `/analyze` + `/transform` checks).
- **Trace:** traces/2026-08-09-q003-conform.md

## D6 — 2026-07-13 — The Python engine (`mts`) is Q-003's provider, NOT `tonality-core`

- **Decision:** Tonality-Live's provider is the pure-Python Tonality engine
  (`mts`, `~/Documents/Tonality`). `tonality-core` (the C++ repo) is **not** a
  candidate for this repo's needs and no work is planned against it.
- **Why (evidence, not preference):**
  - `tonality-core/README.md` — "The pure-Python engine remains a fully-functional
    peer and **the spec's source of truth**"; its scope is "deliberately the frozen
    kernel": only the 4096-row set-class identity substrate. "The analysis,
    temporal, rules, search, and pattern layers of the engine stay Python-only
    until they freeze."
  - Its entire public surface is `bitmask/chirality/dft/json_format/setclass/table`
    headers — no key induction, no chord naming, no scale conform.
  - `Tonality/CPP_PORT.md:79-83` lists "the MCP/**bridge tool surfaces**" as
    *deferred behind the Phase 6 fence* — i.e. exactly the surface this repo
    consumes.
  - `Tonality/ROADMAP.md:1704` already records our request as Phase 7
    "note-transform slice 0, accepted from Tonality-Live brief-001", generative-side.
- **What would change it:** only a different product shape — running inside the
  audio thread, or embedding the engine in the `.ablx` with no localhost service.
  That needs Phase 6 plus the deferred analysis layer ported (provider sizing:
  3–5 person-months for full parity).
- **Trace:** traces/2026-07-13-ratify-q003.md

## D5 — 2026-07-13 — Ratify Tonality's Q-003 rulings, with two musical refinements

- **Decision:** Accept all five architecture rulings in
  `Tonality/integrations/Tonality-Live/response.md` — generative-side homing; one
  `conform_to_scale` primitive with a `fit_to_key` wrapper; register-preserving;
  the two by-construction guarantees; `revoice` deferred to their Phase 7. Filed
  `ratify.md` on the channel, returning the ball to the provider.
- **Two refinements requested** (both musical, neither blocking the mechanism):
  1. **Tie-break frequency.** Their Ruling 3 calls ties rare, citing harmonic
     minor's augmented second — but that gap is 3 semitones (odd) and can never
     tie. Ties need an *even* gap, and whole-tone gaps dominate diatonic scales.
     Verified exhaustively: **C major 5/5 out-of-scale pcs tie**, whole-tone 6/6,
     harmonic minor 3/5. So `tie_break="down"` governs every accidental, not a
     corner case — asked them to choose the default deliberately.
  2. **Pitch collisions.** Conform is many-to-one; accepted contract test 3
     (preserve note count, change only pitch) therefore *keeps* duplicate
     notes at identical pitch/onset/duration. Corroborated by their own
     `ROADMAP.md:1711-1716` impossibility result ("a locality-preserving map is
     necessarily partial wherever a step collapses"). Asked for an explicit
     dedupe-or-document ruling.
- **Not done:** no consumer-side implementation of the snap, under any schedule
  pressure — that stays the invariant. `/transform` remains a visible 501.
- **Trace:** traces/2026-07-13-ratify-q003.md

## D4 — 2026-07-13 — Push permission gated on a green oracle (not a blanket deny)

- **Decision:** Replace the harness's blanket `Bash(git push*)` deny with a
  conditional gate: `git push` is allow-listed, but a PreToolUse hook
  (`.claude/hooks/pretool-push-gate.sh`) blocks it unless
  `.harness/last-verify.json` shows `exit == 0`. Force-push stays denied.
- **Why:** The human authorized auto-push "once the CI is green." This
  project's CI is the `./verify` oracle, so the gate is deterministic and
  hook-enforced (doctrine: freeze/permission is enforced by hooks, never
  prose), not a human prompt every time. Green-before-publish is preserved;
  the friction of a prompt on every push is removed.
- **Scope:** `.claude/settings.json` (allow/deny + hook wiring), new hook.
  Force-push and `reset --hard` remain denied.
- **Follow-up:** no GitHub Actions workflow exists yet; if one is added later,
  fold its status into (or alongside) this gate. Tracked informally, not a
  queue item until wanted.
- **Trace:** traces/2026-07-13-ratify-and-push-policy.md

## D3 — 2026-07-13 — Manifest ratified

- **Decision:** `project.manifest.json` is RATIFIED (was provisional). The
  human confirmed the survey answers, architecture **rung 1** included.
- **Why:** Closes the retrofit's open ratification gate; the manifest is now
  the settled source for this project's shape.
- **Trace:** traces/2026-07-13-ratify-and-push-policy.md

## D2 — 2026-07-13 — Push the retrofit to the remote

- **Decision:** Publish the harness-retrofit commit (D1) to
  `github.com/Lifted-Truck/Tonality-Live` (branch `main`). The human added
  the push to the plan and authorized it explicitly.
- **Why:** The remote already exists and was pushed to for the prior README
  change; keeping the harness commit local-only would leave the published
  repo mid-retrofit. Manifest remains provisional (D1) — ratification of the
  survey answers is tracked separately and is not blocked by publishing.
- **Scope:** `git push origin main` only; no force, no history rewrite.
- **Trace:** traces/2026-07-13-push.md (cites the retrofit trace)

## D1 — 2026-07-13 — Retrofit the ecosystem harness at architecture rung 1

- **Decision:** Adopt the standard agent harness (CLAUDE.md charter, `./verify`
  oracle, ROADMAP/DECISIONS, knowledge loop, `.claude/` agents+hooks, traces)
  on this pre-existing repo, at **rung 1 (single-threaded agent)**.
- **Why rung 1:** ~411 LOC thin extension + bridge, one developer, no
  parallelizable verifiable work; the ~7–15× token cost of subagents is
  unjustified (doctrine: right-size the agent architecture). Chosen explicitly
  by the human, not defaulted.
- **Oracle shape:** the oracle WRAPS existing commands (`tsc --noEmit`,
  `py_compile`, `npm run build`) plus a live bridge contract check; it invents
  no new test setup. Real unit suites are recorded as debt (ROADMAP Q-002),
  not silently gated on.
- **Consumer status:** this repo consumes the Tonality (`mts`) engine. A brief
  for the `/transform` functions (fit-to-key, scale-conform, revoice) was filed
  to `~/Documents/Tonality/integrations/Tonality-Live/` (ball: provider).
- **Non-destructive:** README body and all `extension/`/`bridge/` source were
  left untouched; only marker-delimited appends to README.md and .gitignore.
- **Trace:** traces/2026-07-13-retrofit.md
