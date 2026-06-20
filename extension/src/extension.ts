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

import { analyze, type AnalyzeResult } from "./bridge.js";
import { transpose } from "./transform.js";

import analysisHtml from "../ui/analysis.html";
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

  // --- Menu wiring -------------------------------------------------------------
  context.ui.registerContextMenuAction("MidiClip", "Analyze with Tonality", "tonality.analyzeClip");
  context.ui.registerContextMenuAction("MidiClip", "Transpose…", "tonality.transpose");
}

/** Show the analysis dialog by inlining the payload into the HTML template. */
async function showAnalysis(
  context: ReturnType<typeof initialize>,
  payload: { summary?: AnalyzeResult["summary"]; error?: string },
): Promise<void> {
  const html = analysisHtml.replace("__TONALITY_PAYLOAD__", JSON.stringify(payload));
  const url = `data:text/html,${encodeURIComponent(html)}`;
  await context.ui.showModalDialog(url, 420, 480);
}
