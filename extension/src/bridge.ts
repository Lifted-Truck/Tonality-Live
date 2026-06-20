/**
 * Client for the Tonality bridge — the local HTTP service that wraps the Python
 * engine (see ../../bridge/server.py). The Extension Host is a full Node runtime,
 * so we just use global `fetch`.
 */

const BASE = process.env.TONALITY_BRIDGE_URL ?? "http://127.0.0.1:8765";

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

export async function analyze(payload: AnalyzePayload): Promise<AnalyzeResult> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(
      `Can't reach the Tonality bridge at ${BASE}. Start it first:\n` +
        `  <Tonality>/.venv/bin/python3.13 <Tonality-Live>/bridge/server.py\n(${String(err)})`,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Bridge returned ${response.status}: ${body}`);
  }
  return (await response.json()) as AnalyzeResult;
}
