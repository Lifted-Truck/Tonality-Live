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


@unittest.skipUnless(_HAVE_ENGINE, "mts engine not importable (run with the Tonality venv)")
class TransformMarshalling(unittest.TestCase):
    """/transform glue: op dispatch, NoteDescription reshaping, error mapping.

    The snap itself is the engine's and is tested there — what is ours is that
    the right entry point is called and the note list crosses the boundary intact.
    """

    # C, C#, D, F# in C major: C# -> C (colliding with the C already there),
    # F# -> F. The case pinned in the ratification exchange.
    CHROMATIC = {
        "bpm": 120,
        "notes": [
            {"pitch": 60, "startTime": 0, "duration": 1},
            {"pitch": 61, "startTime": 0, "duration": 1},
            {"pitch": 62, "startTime": 0, "duration": 1},
            {"pitch": 66, "startTime": 0, "duration": 1},
        ],
    }

    def test_fit_to_key_returns_note_descriptions(self):
        out = server.transform(
            {"op": "fit_to_key", "tonicPc": 0, "mode": "major", **self.CHROMATIC}
        )
        self.assertEqual([n["pitch"] for n in out["notes"]], [60, 60, 62, 65])
        for note in out["notes"]:  # exactly the SDK shape, nothing extra
            self.assertEqual(set(note), {"pitch", "startTime", "duration", "velocity"})

    def test_note_count_and_timing_preserved(self):
        out = server.transform(
            {"op": "fit_to_key", "tonicPc": 0, "mode": "major", **self.CHROMATIC}
        )
        self.assertEqual(len(out["notes"]), len(self.CHROMATIC["notes"]))
        for before, after in zip(self.CHROMATIC["notes"], out["notes"]):
            self.assertEqual(before["startTime"], after["startTime"])
            self.assertEqual(before["duration"], after["duration"])

    def test_collisions_are_reported_not_resolved(self):
        # R2 keep-and-report: the duplicate stays in `notes`, and is itemized.
        out = server.transform(
            {"op": "fit_to_key", "tonicPc": 0, "mode": "major", **self.CHROMATIC}
        )
        collisions = out["report"]["collisions"]
        self.assertEqual(len(collisions), 1)
        self.assertEqual(collisions[0]["midi"], 60)
        self.assertEqual(collisions[0]["source_midis"], [60, 61])
        self.assertEqual([n["pitch"] for n in out["notes"]].count(60), 2)

    def test_report_carries_no_events_key(self):
        # `events` becomes `notes`; leaving both would be two sources of truth.
        out = server.transform(
            {"op": "fit_to_key", "tonicPc": 0, "mode": "major", **self.CHROMATIC}
        )
        self.assertNotIn("events", out["report"])

    def test_conform_to_scale_by_catalog_name(self):
        out = server.transform(
            {
                "op": "conform_to_scale",
                "scale": "Whole Tone",
                "rootPc": 0,
                "notes": [{"pitch": 61, "startTime": 0, "duration": 1}],
            }
        )
        self.assertEqual(out["report"]["degrees"], [0, 2, 4, 6, 8, 10])
        self.assertIn(out["notes"][0]["pitch"] % 12, out["report"]["degrees"])

    def test_tie_break_is_passed_through(self):
        base = {"op": "fit_to_key", "tonicPc": 0, "mode": "major",
                "notes": [{"pitch": 61, "startTime": 0, "duration": 1}]}
        down = server.transform({**base, "tieBreak": "down"})
        up = server.transform({**base, "tieBreak": "up"})
        self.assertEqual(down["notes"][0]["pitch"], 60)
        self.assertEqual(up["notes"][0]["pitch"], 62)

    def test_revoice_still_raises_not_implemented(self):
        # Deferred upstream to Tonality's Phase 7 — must stay a visible 501.
        with self.assertRaises(NotImplementedError):
            server.transform({"op": "revoice", **self.CHROMATIC})

    def test_unknown_op_rejected(self):
        with self.assertRaises(ValueError):
            server.transform({"op": "nope", **self.CHROMATIC})

    def test_missing_required_params_rejected(self):
        with self.assertRaises(ValueError):
            server.transform({"op": "fit_to_key", **self.CHROMATIC})  # no tonicPc
        with self.assertRaises(ValueError):
            server.transform({"op": "conform_to_scale", "rootPc": 0, **self.CHROMATIC})


@unittest.skipUnless(_HAVE_ENGINE, "mts engine not importable (run with the Tonality venv)")
class RemapByDegree(unittest.TestCase):
    """/transform op=remap_by_degree — TRANSLATION, not cleanup.

    The distinction these tests exist to protect: conform snaps by proximity and
    can merge neighbours; remap maps degree→degree and cannot. Routing a
    "make this Dorian" request into conform silently destroys scale walks
    (provider notice notice-conform-vs-remap.md, adopted 2026-08-11).
    """

    # A descending scale walk: one scale step per note. The shape that exposes
    # the difference, and the shape the human actually broke in Live.
    WALK = {"notes": [{"pitch": p, "startTime": i, "duration": 1}
                      for i, p in enumerate([67, 65, 64, 62, 60])]}  # G F E D C

    def _remap(self, target, root=0, source="Ionian", source_root=0, **kw):
        return server.transform({**self.WALK, "op": "remap_by_degree",
                                 "sourceScale": source, "sourceRoot": source_root,
                                 "targetScale": target, "targetRoot": root, **kw})

    def test_walk_survives_remap(self):
        out = self._remap("Natural Minor")
        got = [n["pitch"] for n in out["notes"]]
        self.assertEqual(got, [67, 65, 63, 62, 60])          # G F D# D C
        self.assertEqual(len(set(got)), 5, "remap must not merge notes")

    def test_conform_merges_the_same_walk(self):
        """The contrast, pinned. Not a bug in conform — it is what proximity IS.

        If this ever stops merging, the engine's conform semantics changed and the
        UI's 'this one may merge notes' labelling needs revisiting.
        """
        out = server.transform({**self.WALK, "op": "conform_to_scale",
                                "scale": "Natural Minor", "rootPc": 0})
        got = [n["pitch"] for n in out["notes"]]
        self.assertEqual(got, [67, 65, 65, 62, 60])           # E merged into F
        self.assertLess(len(set(got)), 5, "conform is expected to merge here")

    def test_identity_remap_changes_nothing(self):
        # Compare by onset, not by list position: output comes back in the
        # engine's canonical (onset, midi) order, which is NOT the wire order
        # (tonality-live-002). An earlier draft of this test asserted a
        # pitch-sorted list and failed for exactly that reason.
        out = self._remap("Ionian")
        self.assertEqual({n["startTime"]: n["pitch"] for n in out["notes"]},
                         {n["startTime"]: n["pitch"] for n in self.WALK["notes"]})
        self.assertEqual(out["report"]["edits"], [])

    def test_returns_note_descriptions_and_a_report(self):
        out = self._remap("Natural Minor")
        for note in out["notes"]:
            self.assertEqual(set(note), {"pitch", "startTime", "duration", "velocity"})
        self.assertNotIn("events", out["report"])
        for key in ("edits", "notes_total", "notes_diatonic", "notes_chromatic"):
            self.assertIn(key, out["report"])

    def test_edits_pair_on_onset_and_from_midi(self):
        # The documented pairing idiom (tonality-live-002): events come back in
        # the engine's canonical order, so never pair by list position.
        out = self._remap("Natural Minor")
        edits = out["report"]["edits"]
        self.assertEqual([(e["onset"], e["from_midi"], e["to_midi"]) for e in edits],
                         [(2.0, 64, 63)])

    def test_unequal_cardinality_is_refused_with_a_reason(self):
        # A refusal the UI can surface beats a silently broken walk. The engine
        # owns the reason string; we must not swallow or paraphrase it.
        with self.assertRaises(ValueError) as ctx:
            self._remap("Minor Pentatonic")
        msg = str(ctx.exception).lower()
        self.assertIn("cardinality", msg)
        self.assertIn("7", msg)
        self.assertIn("5", msg)

    def test_missing_parameters_are_rejected(self):
        for omit in ("sourceScale", "sourceRoot", "targetScale", "targetRoot"):
            body = {**self.WALK, "op": "remap_by_degree", "sourceScale": "Ionian",
                    "sourceRoot": 0, "targetScale": "Dorian", "targetRoot": 0}
            del body[omit]
            with self.assertRaises(ValueError, msg=f"omitting {omit} should raise"):
                server.transform(body)

    def test_modal_transform_is_visibly_deferred(self):
        # 501, not a silent fallback to remap — see the op's comment for why.
        with self.assertRaises(NotImplementedError):
            server.transform({**self.WALK, "op": "modal_transform",
                              "targetScale": "Dorian"})


@unittest.skipUnless(_HAVE_ENGINE, "mts engine not importable (run with the Tonality venv)")
class ScaleCatalog(unittest.TestCase):
    def test_scales_are_served_from_the_engine(self):
        out = server.scales()
        names = [s["name"] for s in out["scales"]]
        self.assertIn("Ionian", names)
        self.assertEqual(names, sorted(names))
        ionian = next(s for s in out["scales"] if s["name"] == "Ionian")
        self.assertEqual(ionian["degrees"], [0, 2, 4, 5, 7, 9, 11])


if __name__ == "__main__":
    if not _HAVE_ENGINE:
        print(f"SKIP: bridge tests need the Tonality engine — {_WHY}", file=sys.stderr)
    unittest.main(verbosity=2)
