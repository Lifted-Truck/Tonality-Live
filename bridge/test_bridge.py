"""Unit tests for the bridge's own glue — the code THIS repo owns.

Scope (INTEGRATIONS rule 3): we test JSON<->Sequence marshalling and the
display-summary shaping. We do NOT test mts's analysis — that is the provider's
domain and has its own tests. These need `mts` importable, so like `./verify
full` they SKIP (not fail) when the Tonality engine is absent; run them with
the Tonality venv:

    TONALITY_REPO=~/Documents/Tonality ~/Documents/Tonality/.venv/bin/python3 \
        -m unittest -v bridge/test_bridge.py
"""

import os
import sys
import unittest

# Resolve `import server` and `import mts` the same way server.py does.
_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.environ.get("TONALITY_REPO", os.path.expanduser("~/Documents/Tonality"))
if os.path.isdir(os.path.join(_REPO, "mts")):
    sys.path.insert(0, _REPO)
sys.path.insert(0, _HERE)

try:
    import server  # noqa: E402  (import after sys.path setup, by design)
    _HAVE_ENGINE = True
    _WHY = ""
except Exception as exc:  # mts / mido absent -> degrade like ./verify full
    _HAVE_ENGINE = False
    _WHY = f"{type(exc).__name__}: {exc}"


@unittest.skipUnless(_HAVE_ENGINE, "mts engine not importable (run with the Tonality venv)")
class SummaryShaping(unittest.TestCase):
    """_summarize / _chord_label are pure dict->dict — the display contract the
    extension's dialog renders. Pinned goldens over a representative mts result."""

    def test_summarize_pins_key_and_chords(self):
        result = {
            "key": {
                "candidates": [{"tonic_pc": 0, "mode": "major", "score": 0.9}],
                "margin": 0.3,
            },
            "dataset": {
                "records": [
                    {
                        "kind": "segment",
                        "placement": {"onset": 0},
                        "identity": {"pcs": [0, 4, 7]},
                        "analysis": {
                            "naming": {
                                "chosen": {
                                    "functional_role": "I",
                                    "interpretation": {"root_pc": 0, "quality": "maj"},
                                }
                            }
                        },
                    }
                ]
            },
        }
        self.assertEqual(
            server._summarize(result),
            {
                "key": {"name": "C major", "score": 0.9, "margin": 0.3},
                "chords": [{"onset": 0, "name": "C maj", "role": "I", "pcs": [0, 4, 7]}],
            },
        )

    def test_summarize_tolerates_empty_result(self):
        self.assertEqual(server._summarize({}), {"key": None, "chords": []})

    def test_summarize_skips_non_segment_records(self):
        result = {"dataset": {"records": [{"kind": "meta"}]}}
        self.assertEqual(server._summarize(result), {"key": None, "chords": []})

    def test_chord_label(self):
        self.assertEqual(server._chord_label(None), "?")
        self.assertEqual(server._chord_label({"root_pc": 7, "quality": "min"}), "G min")
        self.assertEqual(server._chord_label({"root_pc": 2}), "D")  # quality omitted


@unittest.skipUnless(_HAVE_ENGINE, "mts engine not importable (run with the Tonality venv)")
class SequenceMarshalling(unittest.TestCase):
    """_sequence_from_payload — the notes-JSON -> Sequence boundary."""

    def test_empty_notes_rejected(self):
        with self.assertRaises(ValueError):
            server._sequence_from_payload({"notes": []})

    def test_missing_notes_rejected(self):
        with self.assertRaises(ValueError):
            server._sequence_from_payload({"bpm": 120})

    def test_all_out_of_range_rejected(self):
        # Every note filtered (pitch > 127) -> no events -> ValueError, before
        # any mts object is built.
        with self.assertRaises(ValueError):
            server._sequence_from_payload(
                {"notes": [{"pitch": 200, "startTime": 0, "duration": 1}]}
            )

    def test_zero_duration_filtered(self):
        with self.assertRaises(ValueError):
            server._sequence_from_payload(
                {"notes": [{"pitch": 60, "startTime": 0, "duration": 0}]}
            )

    def test_valid_payload_builds_a_sequence(self):
        seq = server._sequence_from_payload(
            {
                "bpm": 120,
                "notes": [
                    {"pitch": 60, "startTime": 0, "duration": 1},
                    {"pitch": 64, "startTime": 1, "duration": 0.5, "velocity": 80},
                ],
            }
        )
        self.assertIsInstance(seq, server.Sequence)


if __name__ == "__main__":
    if not _HAVE_ENGINE:
        print(f"SKIP: bridge tests need the Tonality engine — {_WHY}", file=sys.stderr)
    unittest.main(verbosity=2)
