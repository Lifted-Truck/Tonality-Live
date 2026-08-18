/**
 * Client for the Tonality bridge — the local HTTP service that wraps the Python
 * engine (see ../../bridge/server.py). The Extension Host is a full Node runtime,
 * so we just use global `fetch`.
 */

import { ensureBridge } from "./bridgeProcess.js";

const BASE = process.env.TONALITY_BRIDGE_URL ?? "http://127.0.0.1:8765";
export const BRIDGE_BASE = BASE;

/**
 * The extension's storage directory, handed over once by activate(). Needed so
 * a failed request can try to auto-start the bridge (ROADMAP Q-011) — the
 * launch config lives there because it is machine identity.
 */
let storageDir: string | undefined;
export function configureBridgeAutostart(dir: string | undefined): void {
  storageDir = dir;
}

export interface BridgeNote {
  pitch: number;
  startTime: number;
  duration: number;
  velocity?: number;
}

export interface AnalyzePayload {
  notes: BridgeNote[];
  bpm?: number;
  timeSignature?: [number, number];
  options?: Record<string, unknown>;
}

export interface AnalysisSummary {
  key: { name: string; score: number; margin: number } | null;
  chords: Array<{
    onset: number | null;
    name: string;
    role: string | null;
    pcs: number[] | null;
  }>;
}

/** Full pass-through of `midi_file_analysis`, plus a display-ready `summary`. */
export interface AnalyzeResult {
  summary: AnalysisSummary;
  key: unknown;
  dataset: unknown;
  key_regions?: unknown;
}

/** One collision the engine's snap created — reported, never resolved upstream. */
export interface Collision {
  voice: string | null;
  onset: number;
  duration: number;
  midi: number;
  count: number;
  /** The distinct input pitches that merged onto `midi`. */
  source_midis: number[];
}

/** One snapped note. Engine field names pass through verbatim (snake_case). */
export interface ConformEdit {
  index: number;
  voice: string | null;
  onset: number;
  from_midi: number;
  to_midi: number;
  delta: number;
  tied: boolean;
  tie_resolution: string | null;
}

/** The engine's `ConformResult`, minus `events` (which the bridge turns into `notes`). */
export interface ConformReport {
  scale_name: string | null;
  degrees: number[];
  root_pc: number;
  tie_break: string;
  edits: ConformEdit[];
  collisions: Collision[];
  notes_total: number;
  notes_snapped: number;
  ties_resolved: number;
}

export interface TransformResult {
  /** Conformed notes, 1:1 with the input order — pitch is the only changed field. */
  notes: Required<BridgeNote>[];
  report: ConformReport;
}

interface TransformCommon {
  notes: BridgeNote[];
  bpm?: number;
  /** Engine default is "previous" (melodic continuity); "down"/"up" force a direction. */
  tieBreak?: "previous" | "down" | "up";
}

export type TransformPayload =
  | (TransformCommon & { op: "fit_to_key"; tonicPc: number; mode: "major" | "minor" })
  | (TransformCommon & { op: "conform_to_scale"; scale: string; rootPc: number });

export interface ScaleInfo {
  name: string;
  degrees: number[];
}

/** Every bridge call funnels through here so the "start the bridge" advice lives once. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, init);
  } catch (firstErr) {
    // The bridge is down. Try to bring it up ONCE, then retry the same request.
    // ensureBridge throws an actionable message when it cannot (no config, spawn
    // failure, no /health in time) — that message is what the user sees, so the
    // failure is never a silent hang and never a bare "fetch failed".
    try {
      await ensureBridge(BASE, storageDir);
    } catch (startErr) {
      throw new Error(`${(startErr as Error).message}\n(original error: ${String(firstErr)})`);
    }
    response = await fetch(`${BASE}${path}`, init);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Bridge returned ${response.status}: ${body}`);
  }
  return (await response.json()) as T;
}

function postJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function analyze(payload: AnalyzePayload): Promise<AnalyzeResult> {
  return postJson<AnalyzeResult>("/analyze", payload);
}

/**
 * Conform a clip to a key or scale. All musical decisions — nearest member, tie
 * resolution, what counts as a collision — are the engine's; this is transport.
 */
export function transform(payload: TransformPayload): Promise<TransformResult> {
  return postJson<TransformResult>("/transform", payload);
}

/** The engine's scale catalog. Fetched, never hardcoded — it would go stale. */
export async function fetchScales(): Promise<ScaleInfo[]> {
  const { scales } = await request<{ scales: ScaleInfo[] }>("/scales");
  return scales;
}

/** What the workshop page hands back when the user hits Render (or Cancel). */
export interface WorkshopResult {
  notes: Required<BridgeNote>[] | null;   // null = cancelled
  report?: ConformReport & { pre_transpose?: number; notes_folded?: number };
  /**
   * Display label for the key the render lands in, e.g. "C Dorian" — used to
   * name the clip. The page supplies it because that is where the target was
   * chosen; null when it could not be established (a transpose whose result the
   * engine declined to analyse), in which case the clip keeps its name.
   */
  keyLabel?: string | null;
  /**
   * Scale words the engine knows, so a key already stated in the clip name can
   * be recognised and replaced. Comes from the engine catalog — this repo holds
   * no scale table of its own.
   */
  keyVocab?: string[];
}

/**
 * Park a clip for the workshop and get the URL to open.
 *
 * The modal dialog is a plain web page: it cannot call back into the SDK, so the
 * clip is handed over out-of-band and the page is told which one to load. The
 * page is served by the bridge — see ROADMAP Q-004 for why, and for the two
 * rules that keep a `data:`-URL build possible instead.
 */
export async function openWorkshopFor(
  notes: BridgeNote[],
  bpm: number,
): Promise<string> {
  const { session } = await postJson<{ session: string }>("/session", { notes, bpm });
  return `${BASE}/workshop?s=${encodeURIComponent(session)}`;
}
