/**
 * Unit tests for the one local note transform. Pure arithmetic — no engine, no
 * SDK runtime (the SDK import in transform.ts is type-only, erased at runtime),
 * so this runs in `./verify fast` via node:test + tsx.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { transpose } from "./transform.js";

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
