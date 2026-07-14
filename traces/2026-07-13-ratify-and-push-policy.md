# ratify-and-push-policy — close the retrofit ratification gate; conditional push

- **Queue item:** unqueued: post-retrofit ratification + a permission-policy
  change the human requested. Cites traces/2026-07-13-retrofit.md.
- **Why:** (1) The manifest was provisional; the human ratified it (rung 1
  confirmed). (2) The human authorized auto-push gated on green CI — replacing
  the harness's blanket push-deny with a deterministic oracle gate removes
  per-push prompting while keeping green-before-publish.
- **Evidence consulted:** DECISIONS D3/D4; .claude/settings.json (deny>allow
  precedence forces removing the blanket deny); existing stop-gate.sh as the
  pattern for reading .harness/last-verify.json.
- **What changed:**
  - project.manifest.json: status → RATIFIED.
  - .claude/settings.json: dropped `Bash(git push*)` deny; added
    `Bash(git push:*)` + `Bash(git commit *)` allow; kept force-push denied;
    wired a second PreToolUse Bash hook.
  - .claude/hooks/pretool-push-gate.sh (new, +x): blocks `git push` unless
    last-verify exit == 0.
  - ROADMAP status line updated.
- **Alternatives rejected:** put the allow in gitignored settings.local.json —
  rejected: deny>allow precedence means the committed deny would still block,
  and the green-gate policy should travel with the repo, not be machine-local.
  Set up GitHub Actions now — deferred; ./verify is the CI until one's wanted.
- **Verify:** `./verify fast` exit 0; push-gate unit-checked — exit 2 on a
  simulated red record, exit 0 on green and on non-push commands.
- **Open questions:** none blocking. A real GH Actions workflow could later
  feed this gate (noted in D4).
