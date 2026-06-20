# Tonality for Ableton Live

An Ableton Live **Extension** (`.ablx`) that analyzes and alters MIDI clips using
the [Tonality](../Tonality) music-theory engine.

Right-click a MIDI clip:

- **Analyze with Tonality** → key, chords, and functional roles in a dialog.
- **Transpose…** → shift the clip by N semitones (one undo step).

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

This repo is **authored but not yet built** — the build step needs the beta SDK,
which can't be committed. On this machine:

- ✅ Ableton Live 12 Beta installed (Extension Host present)
- ✅ Tonality engine + venv (`mts` importable) — the bridge is verified working
- ⚠️ Node `v24.10.0`; the SDK pins `>=24.14.1` — bump Node before building
- ❌ **Extensions SDK not downloaded** — get it via the Ableton Beta Program
  (Centercode), unpack it, and drop the three tarballs into
  [`extension/vendor/`](extension/vendor/README.md)

## Build & run (once the SDK is in place)

1. Enable **Developer Mode** in Live → *Preferences → Extensions*.
2. Start the bridge (keep it running):
   ```bash
   /Users/machinepriest/Documents/Tonality/.venv/bin/python3.13 bridge/server.py
   ```
3. Build + load the extension into Live:
   ```bash
   cd extension
   cp .env.example .env        # EXTENSION_HOST_PATH is pre-filled for this Mac
   npm install                 # needs vendor/*.tgz present
   npm start                   # builds, loads into Live's Extension Host
   ```
4. Right-click a MIDI clip in Live → **Analyze with Tonality**.
5. Package a distributable: `npm run package` → `dist/*.ablx`.

Logs (incl. `console.log`) go to Live's `ExtensionHost.txt`
(`~/Library/Preferences/Ableton/Live <ver>/ExtensionHost.txt` on macOS).

## Roadmap

v1 ships analysis end-to-end plus transpose. The next "alter" features
(fit-to-key, scale-conform, revoice) need new transform functions in the
Tonality engine first — they hang off the bridge's `/transform` seam. See
[bridge/README.md](bridge/README.md#the-transform-seam).
