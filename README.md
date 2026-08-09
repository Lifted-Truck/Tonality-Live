# Tonality for Ableton Live

An Ableton Live **Extension** (`.ablx`) that analyzes and alters MIDI clips using
the [Tonality](https://github.com/Lifted-Truck/Tonality) music-theory engine
(the `mts` Python package — see [step 1 of Build & run](#build--run-once-the-sdk-is-in-place) to install it).

Right-click a MIDI clip:

- **Analyze with Tonality** → key, chords, and functional roles in a dialog.
- **Transpose…** → shift the clip by N semitones (one undo step).
- **Fit to Key…** → snap out-of-key notes to the nearest key note.
- **Conform to Scale…** → the same, against any of the engine's 37 scales.

The two conform actions are register-preserving (only the pitch-class moves) and
each lands as one undo step. Where a note sits exactly between two scale notes —
which in a major key is *every* out-of-key note — the tie resolves toward the
previous note by default; you can force up or down in the dialog.

## How it fits together

A Live Extension is a Node/TypeScript module Live loads at **edit time** — it is
**not** a real-time MIDI processor (for live note transformation use a MIDI
effect or Max for Live). It can't import Python, so the music theory stays in
Tonality and the extension reaches it over HTTP:

```
Ableton Live  ──▶  extension/ (TypeScript, .ablx)
                       │  reads clip.notes, writes them back
                       ▼
                   bridge/ (Python HTTP, wraps mts)  ──▶  Tonality engine (mts)
```

- **`extension/`** — the `.ablx` project. Thin: reads/writes `clip.notes`, calls
  the bridge, renders dialogs. No theory here.
- **`bridge/`** — a dependency-free local HTTP service that rebuilds a Tonality
  `Sequence` from notes and runs `mts.mcp.tools.midi_file_analysis`. Run it with
  the Tonality venv. See [bridge/README.md](bridge/README.md).

## Status & prerequisites

Two things you must supply yourself before this runs — neither can be committed:

- **The Tonality engine** (the `mts` Python package) — the bridge imports it.
  Install it (step 1 below); it is **not** bundled here.
- **The Ableton Extensions SDK** — a beta-gated distribution (not on npm). Get it
  via the Ableton Beta Program (Centercode), unpack the archive, and drop its
  three `*.tgz` tarballs into [`extension/vendor/`](extension/vendor/README.md).
  `npm install` resolves them via the `file:./vendor/...` paths in
  `extension/package.json`.

On this machine:

- ✅ Ableton Live 12 Beta installed (Extension Host present)
- ✅ Extensions SDK vendored; extension builds (`npm run build` → `dist/extension.js`)
- ✅ Tonality engine + venv (`mts` importable) — the bridge is verified working
- ⚠️ Node `v24.10.0`; the SDK pins `>=24.14.1` — only an `EBADENGINE` warning
  today, but bump Node if the Extension Host misbehaves

## Build & run (once the SDK is in place)

1. **Install the Tonality engine** (Python ≥ 3.10). The bridge needs `mts`
   importable; there is no PyPI release, so clone it and install editable into
   its own venv:
   ```bash
   git clone git@github.com:Lifted-Truck/Tonality.git   # or https://github.com/Lifted-Truck/Tonality.git
   cd Tonality
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e .            # pulls in mido; that's the only runtime dep
   python -c "import mts; print('mts OK')"
   ```
   Note the venv's python path — you point the bridge at it in step 3. If you
   clone Tonality somewhere other than `~/Documents/Tonality`, set
   `TONALITY_REPO=/path/to/Tonality` so the bridge finds the source tree.
2. Enable **Developer Mode** in Live → *Preferences → Extensions*.
3. Start the bridge with the Tonality venv's python (keep it running):
   ```bash
   /path/to/Tonality/.venv/bin/python3 bridge/server.py
   # then verify:  curl -s localhost:8765/health   → {"ok": true, "mts": "..."}
   ```
4. Build + load the extension into Live:
   ```bash
   cd extension
   cp .env.example .env        # EXTENSION_HOST_PATH is pre-filled for this Mac
   npm install                 # needs vendor/*.tgz present
   npm start                   # builds, loads into Live's Extension Host
   ```
5. Right-click a MIDI clip in Live → **Analyze with Tonality**.
6. Package a distributable: `npm run package` → `dist/*.ablx`.

Logs (incl. `console.log`) go to Live's `ExtensionHost.txt`
(`~/Library/Preferences/Ableton/Live <ver>/ExtensionHost.txt` on macOS).

## Roadmap

v1 ships analysis end-to-end, transpose, and the conform family (fit-to-key /
conform-to-scale) over the bridge's `/transform` seam. `revoice` is deferred
upstream to Tonality's Phase 7 — it is progression realization, not a snap — and
`/transform` returns a visible 501 for it. See
[bridge/README.md](bridge/README.md).

<!-- HARNESS:START — added by /retrofit (idempotent); edits go between the markers -->
## Development harness

This repo carries the standard agent harness. Orientation for a contributor
(human or agent) without code-diving:

- **[ROADMAP.md](ROADMAP.md)** — single source of truth: what's next, the
  test-coverage debt (Q-002), the `/transform` seam blocked on Tonality (Q-003).
- **[CLAUDE.md](CLAUDE.md)** — the charter; §Domain holds the invariants
  (chiefly: *no music theory lives here* — it stays in the Tonality engine).
- **[CODEMAP.md](CODEMAP.md)** — where everything lives.
- **[DECISIONS.md](DECISIONS.md)** — what's already settled.
- **`./verify fast | full | report`** — the oracle. `fast` = typecheck +
  Python compile-check; `full` also builds the bundle and contract-checks the
  bridge (skipped-with-notice when the Tonality engine is absent).

_Last verified: 2026-08-09 — `./verify full` green end-to-end against a live bridge
(13 extension + 19 bridge tests; `/health` + `/analyze` + `/transform` contract checks)._
<!-- HARNESS:END -->
