# DECISIONS — Tonality-Live

Append-only record of ratified decisions. Newest first. ROADMAP.md holds
direction; this file holds *what was settled and why*, so it is not
re-litigated. Each entry links to a trace where one exists.

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
