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
  configureBridgeAutostart,
  fetchScales,
  openWorkshopFor,
  transform,
  type AnalyzeResult,
  type TransformPayload,
  type TransformResult,
  type WorkshopResult,
} from "./bridge.js";
import { launchConfigPath, readLaunchConfig, writeLaunchConfig } from "./bridgeProcess.js";
import { dedupeCollisions, transpose } from "./transform.js";

import analysisHtml from "../ui/analysis.html";
import bridgeSetupHtml from "../ui/bridge-setup.html";
import conformToScaleHtml from "../ui/conform-to-scale.html";
import fitToKeyHtml from "../ui/fit-to-key.html";
import transposeHtml from "../ui/transpose.html";

export function activate(activation: ActivationContext): void {
  const context = initialize(activation, "1.0.0");
  // Q-011: lets a failed request try to auto-start the bridge. The launch config
  // is machine identity, so it lives in the host-provided storage dir.
  configureBridgeAutostart(context.environment.storageDirectory);

  // Announce activation. Not decoration: Live's ExtensionHost.txt is the only
  // window into whether an extension loaded, and an extension that logs nothing
  // is indistinguishable from one that failed — every other extension on the
  // host announces itself, so silence reads as breakage. Cost this a real
  // debugging session on 2026-08-10.
  console.log("[tonality] activating (SDK 1.0.0)");

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

  // --- Workshop ----------------------------------------------------------------
  // One command that will eventually absorb the four above (ROADMAP Q-004). It
  // is deliberately additive for now: the old items stay until this is proven in
  // Live, because removing a working path before its replacement is trusted is
  // how you end up with neither.
  context.commands.registerCommand("tonality.workshop", async (arg: unknown) => {
    try {
      const clip = context.getObjectFromHandle(arg as Handle, MidiClip);
      if (clip.notes.length === 0) {
        await showAnalysis(context, { error: "This MIDI clip has no notes." });
        return;
      }
      const url = await openWorkshopFor(
        clip.notes.map((n) => ({
          pitch: n.pitch,
          startTime: n.startTime,
          duration: n.duration,
          velocity: n.velocity ?? 96,
        })),
        context.application.song.tempo,
      );
      const reply = await context.ui.showModalDialog(url, 1040, 720);
      const result = JSON.parse(reply) as WorkshopResult;
      if (!result.notes) return;                     // cancelled

      // The page has already applied the transformation; the collisions it may
      // have created are still ours to clean up (engine ruling R2).
      const { notes, removed } = dedupeCollisions(
        result.notes,
        result.report?.collisions ?? [],
      );
      context.withinTransaction(() => {
        clip.notes = notes;
      });
      if (removed > 0) {
        await showAnalysis(context, {
          note: `Rendered. ${removed} note${removed === 1 ? "" : "s"} landed on a ` +
                `pitch already in use and ${removed === 1 ? "was" : "were"} merged away.`,
        });
      }
    } catch (err) {
      console.error("tonality.workshop failed:", err);
      await showAnalysis(context, { error: String(err) });
    }
  });

  // --- Bridge auto-start setup (Q-011) -------------------------------------------
  // A one-time, per-machine step: record where the venv python and server.py are.
  // Registered on the MidiClip menu because that is the only scope we use, and it
  // keeps the setup discoverable next to the commands that need the bridge.
  context.commands.registerCommand("tonality.setupBridge", async () => {
    try {
      const dir = context.environment.storageDirectory;
      if (!dir) {
        await showAnalysis(context, {
          error: "Live did not provide a storage directory for this extension, so auto-start " +
                 "cannot be configured. Start the bridge by hand instead.",
        });
        return;
      }
      const existing = readLaunchConfig(dir);
      const html = bridgeSetupHtml
        .replace("__PYTHON__", existing?.python ?? "")
        .replace("__SERVER__", existing?.server ?? "")
        .replace("__REPO__", existing?.tonalityRepo ?? "");
      const url = `data:text/html,${encodeURIComponent(html)}`;
      const reply = await context.ui.showModalDialog(url, 460, 400);
      const r = JSON.parse(reply) as {
        python: string | null; server?: string; tonalityRepo?: string | null;
      };
      if (!r.python || !r.server) return;                     // cancelled
      const path = writeLaunchConfig(dir, {
        python: r.python,
        server: r.server,
        ...(r.tonalityRepo ? { tonalityRepo: r.tonalityRepo } : {}),
      });
      await showAnalysis(context, {
        note: `Saved. The bridge will be started automatically when a Tonality command ` +
              `finds it down. (${path})`,
      });
    } catch (err) {
      console.error("tonality.setupBridge failed:", err);
      await showAnalysis(context, { error: String(err) });
    }
  });

  // --- Menu wiring -------------------------------------------------------------
  context.ui.registerContextMenuAction("MidiClip", "Tonality Workshop…", "tonality.workshop");
  context.ui.registerContextMenuAction("MidiClip", "Analyze with Tonality", "tonality.analyzeClip");
  context.ui.registerContextMenuAction("MidiClip", "Transpose…", "tonality.transpose");
  context.ui.registerContextMenuAction("MidiClip", "Fit to Key…", "tonality.fitToKey");
  context.ui.registerContextMenuAction("MidiClip", "Conform to Scale…", "tonality.conformToScale");
  context.ui.registerContextMenuAction("MidiClip", "Tonality: Set up bridge auto-start…", "tonality.setupBridge");

  console.log(
    "[tonality] ready — 6 MidiClip actions registered; bridge expected at " +
      (process.env.TONALITY_BRIDGE_URL ?? "http://127.0.0.1:8765") +
      (readLaunchConfig(context.environment.storageDirectory)
        ? "; auto-start configured"
        : `; auto-start NOT configured (${launchConfigPath(context.environment.storageDirectory)})`),
  );
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
