/**
 * Unit tests for the one local note transform. Pure arithmetic — no engine, no
 * SDK runtime (the SDK import in transform.ts is type-only, erased at runtime),
 * so this runs in `./verify fast` via node:test + tsx.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { dedupeCollisions, transpose } from "./transform.js";
import type { Collision } from "./bridge.js";

type Note = { pitch: number; startTime: number; duration: number };
const n = (pitch: number, startTime = 0, duration = 1): Note => ({ pitch, startTime, duration });
const pitches = (notes: readonly { pitch: number }[]): number[] => notes.map((x) => x.pitch);

test("shifts every note by the interval", () => {
  assert.deepEqual(pitches(transpose([n(60), n(64), n(67)], 5)), [65, 69, 72]);
});

test("preserves timing and velocity, changing only pitch", () => {
  const out = transpose([{ pitch: 60, startTime: 1.5, duration: 0.25, velocity: 100 }], 2);
  assert.deepEqual(out, [{ pitch: 62, startTime: 1.5, duration: 0.25, velocity: 100 }]);
});

test("drops notes that fall below MIDI 0", () => {
  // 2 -> -1 (drop), 0 -> -3 (drop), 60 -> 57 (keep)
  assert.deepEqual(pitches(transpose([n(2), n(0), n(60)], -3)), [57]);
});

test("drops notes that exceed MIDI 127", () => {
  // 125 -> 128 (drop), 127 -> 130 (drop), 60 -> 63 (keep)
  assert.deepEqual(pitches(transpose([n(125), n(127), n(60)], 3)), [63]);
});

test("keeps the boundary pitches 0 and 127", () => {
  assert.deepEqual(pitches(transpose([n(3)], -3)), [0]);
  assert.deepEqual(pitches(transpose([n(124)], 3)), [127]);
});

test("a zero shift is identity on pitch", () => {
  assert.deepEqual(pitches(transpose([n(60), n(72)], 0)), [60, 72]);
});

test("an empty clip transposes to empty", () => {
  assert.deepEqual(transpose([], 7), []);
});

// --- dedupeCollisions (R2: engine reports, we clean up) ------------------------

const collision = (midi: number, onset: number, duration: number, sources: number[]): Collision => ({
  voice: null,
  onset,
  duration,
  midi,
  count: sources.length,
  source_midis: sources,
});

test("no collisions reported leaves the clip untouched", () => {
  const notes = [n(60), n(62), n(64)];
  const { notes: out, removed } = dedupeCollisions(notes, []);
  assert.equal(removed, 0);
  assert.deepEqual(out, notes);
});

test("drops the duplicate the snap created, keeping the first in clip order", () => {
  // C and C# both conformed to C: two notes now share pitch 60 at beat 0.
  const notes = [n(60), n(60), n(62)];
  const { notes: out, removed } = dedupeCollisions(notes, [collision(60, 0, 1, [60, 61])]);
  assert.equal(removed, 1);
  assert.deepEqual(pitches(out), [60, 62]);
});

test("leaves duplicates alone when the snap did not create them", () => {
  // Same stacked pair, but the engine reported no collision — it pre-existed,
  // which the engine calls the input's business. We must not touch it.
  const notes = [n(60), n(60)];
  const { notes: out, removed } = dedupeCollisions(notes, []);
  assert.equal(removed, 0);
  assert.deepEqual(pitches(out), [60, 60]);
});

test("only the colliding slot is deduped, not every note at that pitch", () => {
  // Two notes at pitch 60 collide on beat 0; a third at beat 2 is a real note.
  const notes = [n(60, 0), n(60, 0), n(60, 2)];
  const { notes: out, removed } = dedupeCollisions(notes, [collision(60, 0, 1, [60, 61])]);
  assert.equal(removed, 1);
  assert.deepEqual(
    out.map((x) => [x.pitch, x.startTime]),
    [[60, 0], [60, 2]],
  );
});

test("a three-way merge drops two notes", () => {
  const notes = [n(60), n(60), n(60), n(67)];
  const { notes: out, removed } = dedupeCollisions(notes, [collision(60, 0, 1, [59, 60, 61])]);
  assert.equal(removed, 2);
  assert.deepEqual(pitches(out), [60, 67]);
});

test("notes differing only in duration are different slots", () => {
  const notes = [{ pitch: 60, startTime: 0, duration: 1 }, { pitch: 60, startTime: 0, duration: 2 }];
  const { notes: out, removed } = dedupeCollisions(notes, [collision(60, 0, 1, [60, 61])]);
  assert.equal(removed, 0);
  assert.equal(out.length, 2);
});
