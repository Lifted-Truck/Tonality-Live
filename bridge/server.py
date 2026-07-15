"""Tonality bridge — a thin local HTTP service wrapping the Tonality engine.

The Ableton Live extension (TypeScript, runs inside Live's Extension Host) cannot
import Python. It POSTs a clip's notes here as JSON; this service rebuilds a
Tonality ``Sequence`` and runs the *same* tested analysis pipeline the MCP
endpoint uses (``mts.mcp.tools.midi_file_analysis``), then returns the enriched
result plus a compact, display-ready ``summary``.

Intelligence stays in ``mts`` — this file is glue: JSON <-> Sequence, nothing more.
No third-party deps: it runs on the Tonality venv (where ``mts`` is importable)
with the standard library only.

    ~/Documents/Tonality/.venv/bin/python3.13 \
        ~/Documents/Tonality-Live/bridge/server.py

Endpoints
    GET  /health     -> {"ok": true, "mts": "<version>"}
    POST /analyze    -> body {notes, bpm?, timeSignature?} -> midi_file_analysis(...) + summary
    POST /transform  -> 501 (seam for theory-driven alters: fit-to-key, revoice; see README)
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Use the live engine source, not whatever (possibly stale) copy is installed in
# the venv's site-packages. Prepend the Tonality repo root so `import mts`
# resolves to the working tree regardless of the cwd we're launched from.
_TONALITY_REPO = os.path.expanduser(
    os.environ.get("TONALITY_REPO", "~/Documents/Tonality")
)
if os.path.isdir(os.path.join(_TONALITY_REPO, "mts")):
    sys.path.insert(0, _TONALITY_REPO)

from mts.core.pitch import Pitch
from mts.io.midi import sequence_to_midi_file
from mts.mcp.tools import midi_file_analysis
from mts.temporal import Event, Sequence

try:  # version is best-effort; never fatal
    from importlib.metadata import version as _pkg_version

    _MTS_VERSION = _pkg_version("mts")
except Exception:  # pragma: no cover - metadata may be absent for an editable checkout
    _MTS_VERSION = "unknown"

HOST = os.environ.get("TONALITY_BRIDGE_HOST", "127.0.0.1")
PORT = int(os.environ.get("TONALITY_BRIDGE_PORT", "8765"))

_PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


# --- JSON <-> Sequence ---------------------------------------------------------

def _sequence_from_payload(payload: dict) -> Sequence:
    """Build a ``Sequence`` from a clip's notes (the SDK ``NoteDescription`` shape).

    Each note is ``{pitch, startTime, duration, velocity?}`` with times in
    quarter-note beats — exactly what ``MidiClip.notes`` exposes.
    """

    raw_notes = payload.get("notes")
    if not isinstance(raw_notes, list) or not raw_notes:
        raise ValueError("Request must include a non-empty 'notes' array.")

    events: list[Event] = []
    for note in raw_notes:
        midi = int(note["pitch"])
        onset = float(note["startTime"])
        duration = float(note["duration"])
        if not (0 <= midi <= 127):
            continue  # skip out-of-range pitches rather than fail the whole clip
        if duration <= 0:
            continue
        velocity = note.get("velocity")
        velocity = int(velocity) if velocity is not None else 96
        events.append(
            Event(
                onset=max(0.0, onset),
                duration=duration,
                pitch=Pitch.from_midi(midi, velocity=velocity, channel=0),
            )
        )
    if not events:
        raise ValueError("No valid notes after filtering (all out of range or zero-length).")

    bpm = float(payload.get("bpm") or 120.0)
    ts = payload.get("timeSignature") or [4, 4]
    time_signature = (int(ts[0]), int(ts[1]))
    return Sequence.from_events(events, bpm=bpm, time_signature=time_signature)


# --- display-ready summary -----------------------------------------------------

def _chord_label(interpretation: dict | None) -> str:
    if not interpretation:
        return "?"
    root = interpretation.get("root_pc")
    quality = interpretation.get("quality") or ""
    root_name = _PC_NAMES[root % 12] if isinstance(root, int) else "?"
    return f"{root_name} {quality}".strip()


def _summarize(result: dict) -> dict:
    """Extract the few fields the dialog renders, defensively (schema may evolve)."""

    summary: dict = {"key": None, "chords": []}

    key = result.get("key") or {}
    candidates = key.get("candidates") or []
    if candidates:
        best = candidates[0]
        tonic = best.get("tonic_pc")
        summary["key"] = {
            "name": (_PC_NAMES[tonic % 12] if isinstance(tonic, int) else "?")
            + " "
            + str(best.get("mode") or ""),
            "score": best.get("score"),
            "margin": key.get("margin"),
        }

    records = (result.get("dataset") or {}).get("records") or []
    for rec in records:
        if rec.get("kind") != "segment":
            continue
        analysis = rec.get("analysis") or {}
        chosen = (analysis.get("naming") or {}).get("chosen") or {}
        placement = rec.get("placement") or {}
        onset = placement.get("onset")
        if onset is None:
            onset = placement.get("onset_beats", placement.get("start"))
        summary["chords"].append(
            {
                "onset": onset,
                "name": _chord_label(chosen.get("interpretation")),
                "role": chosen.get("functional_role"),
                "pcs": (rec.get("identity") or {}).get("pcs"),
            }
        )
    return summary


def analyze(payload: dict) -> dict:
    """notes JSON -> Sequence -> temp SMF -> midi_file_analysis (the tested path)."""

    sequence = _sequence_from_payload(payload)
    fd, path = tempfile.mkstemp(suffix=".mid")
    os.close(fd)
    try:
        sequence_to_midi_file(sequence, path)
        result = midi_file_analysis(path, **(payload.get("options") or {}))
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
    result["summary"] = _summarize(result)
    return result


# --- HTTP plumbing -------------------------------------------------------------

class _Handler(BaseHTTPRequestHandler):
    server_version = "TonalityBridge/0.1"

    def _send(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw or b"{}")

    def do_GET(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler API)
        if self.path == "/health":
            self._send(200, {"ok": True, "mts": _MTS_VERSION})
        else:
            self._send(404, {"error": f"no route for GET {self.path}"})

    def do_POST(self) -> None:  # noqa: N802
        try:
            payload = self._read_json()
        except json.JSONDecodeError as exc:
            self._send(400, {"error": f"invalid JSON: {exc}"})
            return
        try:
            if self.path == "/analyze":
                self._send(200, analyze(payload))
            elif self.path == "/transform":
                # Seam for theory-driven alters (fit-to-key, revoice). These need
                # new transform functions in mts first — see bridge/README.md.
                self._send(501, {"error": "transform not implemented yet; see README"})
            else:
                self._send(404, {"error": f"no route for POST {self.path}"})
        except (ValueError, KeyError) as exc:
            self._send(400, {"error": str(exc)})
        except Exception as exc:  # pragma: no cover - surface engine errors to the client
            self._send(500, {"error": f"{type(exc).__name__}: {exc}"})

    def log_message(self, fmt: str, *args) -> None:  # quieter, one line per request
        print(f"[bridge] {self.address_string()} {fmt % args}")


def main() -> None:
    httpd = ThreadingHTTPServer((HOST, PORT), _Handler)
    print(f"Tonality bridge listening on http://{HOST}:{PORT}  (mts {_MTS_VERSION})")
    print("  GET  /health   POST /analyze   POST /transform (501)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")
        httpd.shutdown()


if __name__ == "__main__":
    main()
