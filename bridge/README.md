# Tonality bridge

A dependency-free local HTTP service that wraps the Tonality engine so the
Ableton extension (TypeScript, no Python) can use it. It rebuilds a Tonality
`Sequence` from a clip's notes and runs the same tested pipeline the MCP endpoint
uses (`mts.mcp.tools.midi_file_analysis`).

## Install Tonality first

The bridge imports `mts`, so the Tonality engine must be installed. There is no
PyPI release — clone the repo and install it editable into its own venv
(Python ≥ 3.10):

```bash
git clone git@github.com:Lifted-Truck/Tonality.git   # or https://…
cd Tonality
python3 -m venv .venv
source .venv/bin/activate
pip install -e .            # mido is the only runtime dep
```

## Run it

It needs `mts` on the import path, so run it with the **Tonality venv** — no
extra installs beyond that:

```bash
/path/to/Tonality/.venv/bin/python3 \
    /path/to/Tonality-Live/bridge/server.py
```

The bridge prepends the Tonality source tree to `sys.path`, defaulting to
`~/Documents/Tonality`. If your clone lives elsewhere, point it there:

```bash
TONALITY_REPO=/path/to/Tonality /path/to/Tonality/.venv/bin/python3 bridge/server.py
```

Listens on `http://127.0.0.1:8765` (override with `TONALITY_BRIDGE_HOST` /
`TONALITY_BRIDGE_PORT`).

## Endpoints

| Method | Path         | Body                                   | Returns |
|--------|--------------|----------------------------------------|---------|
| GET    | `/health`    | —                                      | `{ok, mts}` |
| GET    | `/scales`    | —                                      | `{scales: [{name, degrees}]}` — the engine's catalog |
| POST   | `/analyze`   | `{notes, bpm?, timeSignature?, options?}` | full `midi_file_analysis` result + `summary` |
| POST   | `/transform` | `{op, notes, ...}` (see below)         | `{notes, report}` |

`notes` is an array of `{pitch, startTime, duration, velocity?}` — exactly the
SDK's `MidiClip.notes` (`NoteDescription`) shape; times are quarter-note beats.

### Quick check

```bash
curl -s localhost:8765/health
curl -s -X POST localhost:8765/analyze -H 'Content-Type: application/json' \
  -d '{"bpm":120,"notes":[{"pitch":60,"startTime":0,"duration":1},
       {"pitch":64,"startTime":0,"duration":1},{"pitch":67,"startTime":0,"duration":1}]}'
```

## `/transform` — conform (shipped)

Transpose runs in the extension (pure arithmetic). The theory-driven alters live
in the engine (`mts.generate.conform`, Phase-7 slice 0) and arrive through here.

```bash
curl -s -X POST localhost:8765/transform -H 'Content-Type: application/json' \
  -d '{"op":"fit_to_key","tonicPc":0,"mode":"major",
       "notes":[{"pitch":60,"startTime":0,"duration":1},
                {"pitch":61,"startTime":0,"duration":1}]}'
```

| `op` | Required | Optional |
|------|----------|----------|
| `fit_to_key` | `tonicPc` (0–11), `mode` (`major`\|`minor`) | `tieBreak` |
| `conform_to_scale` | `rootPc` (0–11), `scale` (catalog name from `/scales`, or a degree list) | `tieBreak` |
| `remap_by_degree` | `sourceScale`, `sourceRoot`, `targetScale`, `targetRoot` | — |

### Conform vs remap — pick by *intent*, they are not interchangeable

Both take "a scale and a root" and return notes, so it is easy to reach for the
wrong one. They answer different questions:

| | question | character |
|---|---|---|
| `conform_to_scale` | make these notes **legal** in S | proximity, many-to-one, **lossy** — cleanup |
| `remap_by_degree` | **translate** this music into S | degree→degree, bijective in-scale — translation |

A descending walk `G F E D C` into C natural minor:

```
conform  ->  G F F D C     E merges into F — the walk is destroyed
remap    ->  G F D# D C     five distinct notes — the walk survives
```

Conform is not broken there; proximity snapping is what it *is* (Ableton's own
Scale tool behaves identically). But a user who asks to "make this Dorian" means
**translate**, so route scale/mode changes through `remap_by_degree`. Keep conform
for constraining incoming material to a key and cleaning stray accidentals.

`remap_by_degree` requires **equal cardinality**: seven degrees cannot translate
into five (pigeonhole), so the engine refuses and the bridge returns **400** with
the engine's own reason. That refusal is deliberate — a surfaceable "this can't
translate, use conform (it will merge)" beats a silently mangled walk.

`modal_transform` (for clips containing key changes) is **not wired yet** and
returns **501**: its result is `{plan, application}` with per-note pairing in
`plan.decisions` rather than the flat `edits` list conform and remap share, plus a
chromatic-policy surface that needs UI decisions first.

`tieBreak` is `previous` (default — resolve toward the previous note in the
voice), `down`, or `up`. It matters more than it sounds: in a major key **every**
out-of-scale pitch class sits exactly between two scale members, so this setting
decides all of them.

The response is `{notes, report}` — `notes` in `NoteDescription` shape, 1:1 with
the input order (pitch is the only field that changes); `report` is the engine's
`ConformResult` minus `events`, carrying `edits`, `collisions`, `degrees`,
`notes_snapped`, `ties_resolved`.

**Collisions are reported, not resolved** (engine ruling R2). A snap is
many-to-one, so two notes can land on one pitch; the engine preserves note count
and itemizes what merged, leaving the choice of survivor to the consumer. The
extension dedupes (first-in-clip-order wins) — that is clip hygiene, not theory.

`revoice` is still deferred upstream to Tonality's Phase 7 proper and returns a
visible **501**.

## How this got here

The seam sat at 501 by design while the engine lacked the functions: the
alternative was a second copy of the theory in the extension, drifting from the
one that answers `/analyze`. Tonality-Live filed brief `tonality-live-001`; the
engine accepted, collapsed `fit_to_key` into `conform_to_scale` with a wrapper,
ruled the tie-break default (`previous`) and collision policy (keep-and-report),
and shipped. The exchange is at
`<Tonality>/integrations/Tonality-Live/{brief,response,ratify,response-2}.md`.

`revoice` is still deferred there — it is progression realization, not a snap.
