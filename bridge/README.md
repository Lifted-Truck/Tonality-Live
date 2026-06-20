# Tonality bridge

A dependency-free local HTTP service that wraps the Tonality engine so the
Ableton extension (TypeScript, no Python) can use it. It rebuilds a Tonality
`Sequence` from a clip's notes and runs the same tested pipeline the MCP endpoint
uses (`mts.mcp.tools.midi_file_analysis`).

## Run it

It needs `mts` on the import path, so run it with the **Tonality venv** — no
extra installs:

```bash
/Users/machinepriest/Documents/Tonality/.venv/bin/python3.13 \
    /Users/machinepriest/Documents/Tonality-Live/bridge/server.py
```

Listens on `http://127.0.0.1:8765` (override with `TONALITY_BRIDGE_HOST` /
`TONALITY_BRIDGE_PORT`).

## Endpoints

| Method | Path         | Body                                   | Returns |
|--------|--------------|----------------------------------------|---------|
| GET    | `/health`    | —                                      | `{ok, mts}` |
| POST   | `/analyze`   | `{notes, bpm?, timeSignature?, options?}` | full `midi_file_analysis` result + `summary` |
| POST   | `/transform` | —                                      | `501` (seam, see below) |

`notes` is an array of `{pitch, startTime, duration, velocity?}` — exactly the
SDK's `MidiClip.notes` (`NoteDescription`) shape; times are quarter-note beats.

### Quick check

```bash
curl -s localhost:8765/health
curl -s -X POST localhost:8765/analyze -H 'Content-Type: application/json' \
  -d '{"bpm":120,"notes":[{"pitch":60,"startTime":0,"duration":1},
       {"pitch":64,"startTime":0,"duration":1},{"pitch":67,"startTime":0,"duration":1}]}'
```

## The `/transform` seam

Transpose runs in the extension (pure arithmetic). Theory-driven alters —
fit-to-key, scale-conform, revoice/voice-leading — belong in the engine but
**don't exist in `mts` yet**: today `mts` analyzes and has only a couple of
generative hooks (`suggest_voicings`, `apply_groove`). Adding those transform
functions to Tonality (and folding the decision into its `ROADMAP.md`) is the
prerequisite for wiring this endpoint to return altered notes.
