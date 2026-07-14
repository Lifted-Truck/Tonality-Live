#!/usr/bin/env bash
# PreToolUse(Bash): allow `git push` ONLY when the oracle is green.
# The human authorized auto-push GATED on ./verify (this project's CI) being
# green — this hook is that gate, deterministic and not overridable by prose.
# Reads hook JSON on stdin; exit 2 blocks the tool call and feeds stderr to Claude.
set -uo pipefail

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || echo "")

# Only gate pushes; everything else passes straight through.
printf '%s' "$CMD" | grep -qE '\bgit( +-C +[^ ]+)? +push\b' || exit 0

LV=".harness/last-verify.json"
if [ ! -f "$LV" ]; then
  echo "Push gate: no oracle run on record. Run ./verify fast and get to green before pushing." >&2
  exit 2
fi

EXIT=$(python3 -c 'import json; print(json.load(open(".harness/last-verify.json")).get("exit",1))' 2>/dev/null || echo 1)
if [ "$EXIT" != "0" ]; then
  echo "Push gate: last oracle run was RED (see ./verify report). Fix to green before pushing — do not publish a red tree." >&2
  exit 2
fi
exit 0
