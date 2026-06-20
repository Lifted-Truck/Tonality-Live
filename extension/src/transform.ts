/**
 * Local note transforms. Transpose is pure arithmetic, so it runs in the
 * extension — no engine round-trip needed. Theory-driven alters (fit-to-key,
 * revoice) belong in the engine and go through the bridge's /transform seam
 * once the corresponding `mts` functions exist (see ../../bridge/README.md).
 */

import type { NoteDescription } from "@ableton-extensions/sdk";

/** Shift every note by `semitones`, dropping any that fall outside MIDI 0–127. */
export function transpose(
  notes: readonly NoteDescription[],
  semitones: number,
): NoteDescription[] {
  return notes
    .map((n) => ({ ...n, pitch: n.pitch + semitones }))
    .filter((n) => n.pitch >= 0 && n.pitch <= 127);
}
