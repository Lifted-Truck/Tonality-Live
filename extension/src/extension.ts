/**
 * Tonality — Ableton Live extension.
 *
 * Right-click a MIDI clip to:
 *   • "Analyze with Tonality"  — send the clip's notes to the Tonality engine
 *     (via the local bridge), show key / chords / functional roles in a dialog.
 *   • "Transpose…"             — shift the clip by N semitones, written back as
 *     one undo step. (The first, simplest "alter"; theory-driven alters land on
 *     the bridge's /transform seam later.)
 *
 * The extension is a thin bridge: it reads/writes `clip.notes` and talks to the
 * engine over HTTP. All music-theory intelligence lives in Tonality (Python).
 */

import {
  initialize,
  MidiClip,
  type ActivationContext,
  type Handle,
} from "@ableton-extensions/sdk";

import {
  analyze,
  fetchScales,
  transform,
  type AnalyzeResult,
  type TransformPayload,
  type TransformResult,
} from "./bridge.js";
import { dedupeCollisions, transpose } from "./transform.js";

import analysisHtml from "../ui/analysis.html";
import conformToScaleHtml from "../ui/conform-to-scale.html";
import fitToKeyHtml from "../ui/fit-to-key.html";
import transposeHtml from "../ui/transpose.html";

export function activate(activation: ActivationContext): void {
  const context = initialize(activation, "1.0.0");

  // --- Analyze -----------------------------------------------------------------
  context.commands.registerCommand("tonality.analyzeClip", async (arg: unknown) => {
    try {
      const clip = context.getObjectFromHandle(arg as Handle, MidiClip);
      const notes = clip.notes;
      if (notes.length === 0) {
        await showAnalysis(context, { error: "This MIDI clip has no notes." });
        return;
      }
      const result: AnalyzeResult = await analyze({
        notes: notes.map((n) => ({
          pitch: n.pitch,
          startTime: n.startTime,
          duration: n.duration,
          velocity: n.velocity ?? 96,
        })),
        bpm: context.application.song.tempo,
      });
      await showAnalysis(context, { summary: result.summary });
    } catch (err) {
      console.error("tonality.analyzeClip failed:", err);
      await showAnalysis(context, { error: String(err) });
    }
  });

  // --- Transpose ---------------------------------------------------------------
  context.commands.registerCommand("tonality.transpose", async (arg: unknown) => {
    try {
      const clip = context.getObjectFromHandle(arg as Handle, MidiClip);
      const url = `data:text/html,${encodeURIComponent(transposeHtml)}`;
      const reply = await context.ui.showModalDialog(url, 320, 180);
      const { semitones } = JSON.parse(reply) as { semitones: number | null };
      if (semitones === null || semitones === 0) return;
      context.withinTransaction(() => {
        clip.notes = transpose(clip.notes, semitones);
      });
    } catch (err) {
      console.error("tonality.transpose failed:", err);
    }
  });

  // --- Fit to key --------------------------------------------------------------
  context.commands.registerCommand("tonality.fitToKey", async (arg: unknown) => {
    await runConform(context, arg, async () => {
      const url = `data:text/html,${encodeURIComponent(fitToKeyHtml)}`;
      const reply = await context.ui.showModalDialog(url, 340, 340);
      const choice = JSON.parse(reply) as {
        tonicPc: number | null;
        mode?: "major" | "minor";
        tieBreak?: "previous" | "down" | "up";
      };
      if (choice.tonicPc === null) return null;
      const mode = choice.mode ?? "major";
      return {
        label: `${PC_NAMES[choice.tonicPc]} ${mode}`,
        payload: {
          op: "fit_to_key",
          tonicPc: choice.tonicPc,
          mode,
          ...(choice.tieBreak ? { tieBreak: choice.tieBreak } : {}),
        },
      };
    });
  });

  // --- Conform to scale --------------------------------------------------------
  context.commands.registerCommand("tonality.conformToScale", async (arg: unknown) => {
    await runConform(context, arg, async () => {
      // The catalog comes from the engine so the picker can't drift from it.
      const scales = await fetchScales();
      const html = conformToScaleHtml.replace(
        "__TONALITY_SCALES__",
        JSON.stringify(scales),
      );
      const url = `data:text/html,${encodeURIComponent(html)}`;
      const reply = await context.ui.showModalDialog(url, 340, 340);
      const choice = JSON.parse(reply) as {
        rootPc: number | null;
        scale?: string;
        tieBreak?: "previous" | "down" | "up";
      };
      if (choice.rootPc === null || !choice.scale) return null;
      return {
        label: `${PC_NAMES[choice.rootPc]} ${choice.scale}`,
        payload: {
          op: "conform_to_scale",
          rootPc: choice.rootPc,
          scale: choice.scale,
          ...(choice.tieBreak ? { tieBreak: choice.tieBreak } : {}),
        },
      };
    });
  });

  // --- Menu wiring -------------------------------------------------------------
  context.ui.registerContextMenuAction("MidiClip", "Analyze with Tonality", "tonality.analyzeClip");
  context.ui.registerContextMenuAction("MidiClip", "Transpose…", "tonality.transpose");
  context.ui.registerContextMenuAction("MidiClip", "Fit to Key…", "tonality.fitToKey");
  context.ui.registerContextMenuAction("MidiClip", "Conform to Scale…", "tonality.conformToScale");
}

/** Display names for pitch classes. Spelling is display-layer only (rule 8). */
const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** What a dialog returns: the op-specific payload plus how to name it to the user. */
interface ConformChoice {
  label: string;
  payload: Omit<TransformPayload, "notes" | "bpm">;
}

/**
 * Shared body of the two conform commands: read the clip, ask the engine, dedupe
 * the collisions it reported, write back as one undo step, then say what changed.
 *
 * `askUser` returns the choice, or null if the user cancelled.
 */
async function runConform(
  context: ReturnType<typeof initialize>,
  arg: unknown,
  askUser: () => Promise<ConformChoice | null>,
): Promise<void> {
  try {
    const clip = context.getObjectFromHandle(arg as Handle, MidiClip);
    if (clip.notes.length === 0) {
      await showAnalysis(context, { error: "This MIDI clip has no notes." });
      return;
    }
    const choice = await askUser();
    if (choice === null) return;

    const result: TransformResult = await transform({
      ...choice.payload,
      notes: clip.notes.map((n) => ({
        pitch: n.pitch,
        startTime: n.startTime,
        duration: n.duration,
        velocity: n.velocity ?? 96,
      })),
      bpm: context.application.song.tempo,
    } as TransformPayload);

    // R2: the engine reports snap-created collisions and leaves the survivor to
    // us. Stacked identical notes are an artifact in a clip, so drop them.
    const { notes, removed } = dedupeCollisions(result.notes, result.report.collisions);

    context.withinTransaction(() => {
      clip.notes = notes;
    });

    await showAnalysis(context, {
      note: describeConform(result, removed, choice.label),
    });
  } catch (err) {
    console.error("tonality conform failed:", err);
    await showAnalysis(context, { error: String(err) });
  }
}

/** One line the user can act on: what moved, and what we quietly cleaned up. */
function describeConform(
  result: TransformResult,
  removed: number,
  target: string,
): string {
  const { notes_snapped, notes_total, ties_resolved } = result.report;
  const parts = [
    `Conformed ${notes_snapped} of ${notes_total} notes to ${target}.`,
  ];
  if (ties_resolved > 0) {
    parts.push(
      `${ties_resolved} sat exactly between two scale notes and were resolved ` +
        `“${result.report.tie_break}”.`,
    );
  }
  if (removed > 0) {
    parts.push(
      `${removed} note${removed === 1 ? "" : "s"} landed on a pitch already in ` +
        `use and ${removed === 1 ? "was" : "were"} merged away.`,
    );
  }
  return parts.join(" ");
}

/** Show the result dialog by inlining the payload into the HTML template. */
async function showAnalysis(
  context: ReturnType<typeof initialize>,
  payload: { summary?: AnalyzeResult["summary"]; error?: string; note?: string },
): Promise<void> {
  const html = analysisHtml.replace("__TONALITY_PAYLOAD__", JSON.stringify(payload));
  const url = `data:text/html,${encodeURIComponent(html)}`;
  await context.ui.showModalDialog(url, 420, 480);
}
