/**
 * Local note transforms — everything here is arithmetic or bookkeeping, never
 * theory. Transpose is a pure shift, so it runs in the extension with no engine
 * round-trip. Theory-driven alters (fit-to-key, conform-to-scale) live in the
 * engine and arrive through the bridge's /transform seam; the only local work
 * they need is `dedupeCollisions` below, which is clip hygiene.
 *
 * Both imports are type-only, so this module has no runtime dependency on the
 * SDK — that is what lets the unit tests run under plain node:test.
 */

import type { NoteDescription } from "@ableton-extensions/sdk";
import type { Collision } from "./bridge.js";

/** Shift every note by `semitones`, dropping any that fall outside MIDI 0–127. */
export function transpose(
  notes: readonly NoteDescription[],
  semitones: number,
): NoteDescription[] {
  return notes
    .map((n) => ({ ...n, pitch: n.pitch + semitones }))
    .filter((n) => n.pitch >= 0 && n.pitch <= 127);
}

/** Identity of a note *slot* — two notes sharing one are indistinguishable in a clip. */
function slotKey(pitch: number, startTime: number, duration: number): string {
  // Fixed precision, not raw floats: these round-trip through Python, and an
  // exact === on a rebuilt double is a coin toss.
  return `${pitch}@${startTime.toFixed(6)}:${duration.toFixed(6)}`;
}

/**
 * Drop duplicate notes that the engine's snap merged onto one pitch.
 *
 * The engine rules keep-and-report (Tonality response-2, R2): it preserves note
 * count and itemizes every collision it *created*, deliberately leaving the
 * choice of survivor to the consumer because it is a musical call. Stacked
 * identical notes are a real artifact in a clip — invisible in the editor,
 * double-triggered on playback — so we drop them, keeping the **first in the
 * clip's original note order**. First-wins is arbitrary but deterministic; it
 * asserts nothing about which note was "better", which is exactly the judgment
 * the engine declined to make.
 *
 * Only slots named in `collisions` are touched. Duplicates that were already in
 * the clip before the snap are the input's business and are left alone.
 */
export function dedupeCollisions(
  notes: readonly NoteDescription[],
  collisions: readonly Collision[],
): { notes: NoteDescription[]; removed: number } {
  if (collisions.length === 0) return { notes: [...notes], removed: 0 };

  const merged = new Set(
    collisions.map((c) => slotKey(c.midi, c.onset, c.duration)),
  );
  const kept = new Set<string>();
  const out: NoteDescription[] = [];
  let removed = 0;

  for (const note of notes) {
    const key = slotKey(note.pitch, note.startTime, note.duration);
    if (merged.has(key)) {
      if (kept.has(key)) {
        removed += 1;
        continue;
      }
      kept.add(key);
    }
    out.push(note);
  }
  return { notes: out, removed };
}
