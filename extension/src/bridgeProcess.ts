/**
 * Auto-start the bridge from inside the Extension Host (ROADMAP Q-011).
 *
 * The bridge is a machine-local service, not a per-session process, so the
 * lifecycle decision (criterion 4) is DETACHED, for two reasons that were
 * verified rather than assumed:
 *
 *   1. The SDK has no deactivate hook — `ExtensionContext` exposes exactly
 *      application/commands/environment/resources/ui — so "reap on deactivate"
 *      is not available. A child tied to the host would simply be orphaned when
 *      the host exits.
 *   2. Idempotence makes detachment safe: we only ever spawn when nothing is
 *      answering `/health`, so a bridge that outlives Live is *reused* on the
 *      next launch, not duplicated. That is the same behaviour as starting it by
 *      hand, minus the hand.
 *
 * Sandbox note: the host runs Node with `--permission --allow-child-process
 * --allow-fs-read=<Extensions dirs>`. That allowlist restricts what NODE may
 * read, not what a spawned child may open — verified by spawning the venv
 * python against bridge/server.py from inside an identical sandbox; it ran up
 * to `bind()` (and failed only because a bridge was already on the port).
 *
 * The interpreter path is machine identity, so it lives in the extension's
 * storage directory (`environment.storageDirectory`, which the host allows us
 * to write) — never in a tracked file. Missing config degrades to today's
 * "start the bridge" message; nothing is guessed.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** What the user tells us once, on this machine, so we can start the bridge. */
export interface BridgeLaunchConfig {
  /** Absolute path to the Tonality venv's python. */
  python: string;
  /** Absolute path to bridge/server.py. */
  server: string;
  /** Optional TONALITY_REPO for the bridge to prepend to sys.path. */
  tonalityRepo?: string;
}

const CONFIG_FILE = "bridge-launch.json";

/** Read the launch config, or null when it has not been set up on this machine. */
export function readLaunchConfig(storageDir: string | undefined): BridgeLaunchConfig | null {
  if (!storageDir) return null;
  const path = join(storageDir, CONFIG_FILE);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<BridgeLaunchConfig>;
    if (typeof raw.python !== "string" || typeof raw.server !== "string") return null;
    return {
      python: raw.python,
      server: raw.server,
      ...(typeof raw.tonalityRepo === "string" ? { tonalityRepo: raw.tonalityRepo } : {}),
    };
  } catch {
    return null;
  }
}

/** Persist the launch config into the extension's storage directory. */
export function writeLaunchConfig(storageDir: string, cfg: BridgeLaunchConfig): string {
  mkdirSync(storageDir, { recursive: true });
  const path = join(storageDir, CONFIG_FILE);
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  return path;
}

/** Where the config lives, for messages that tell the user what to fix. */
export function launchConfigPath(storageDir: string | undefined): string {
  return storageDir ? join(storageDir, CONFIG_FILE) : `<storageDirectory>/${CONFIG_FILE}`;
}

/** True when the bridge answers `/health` with `{ok:true}`. */
export async function bridgeIsUp(base: string, timeoutMs = 1500): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}/health`, { signal: ctl.signal });
    if (!r.ok) return false;
    const d = (await r.json()) as { ok?: boolean };
    return d.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export interface EnsureResult {
  /** "already" = it was up; "started" = we spawned it and it came up. */
  outcome: "already" | "started";
}

/**
 * Make sure a bridge is answering, spawning one if the config allows.
 *
 * Throws with an actionable message when it cannot: no config, spawn failure,
 * or the bridge not answering within `waitMs`. Never hangs silently.
 */
export async function ensureBridge(
  base: string,
  storageDir: string | undefined,
  waitMs = 10_000,
): Promise<EnsureResult> {
  // Criterion 2: never a second bridge if one is already answering.
  if (await bridgeIsUp(base)) return { outcome: "already" };

  const cfg = readLaunchConfig(storageDir);
  if (!cfg) {
    throw new Error(
      `The Tonality bridge is not running, and auto-start is not configured on this machine.\n` +
        `Either start it by hand:\n  <Tonality>/.venv/bin/python3 <Tonality-Live>/bridge/server.py\n` +
        `or run "Tonality: Set up bridge auto-start…" once to record the interpreter path\n` +
        `(config file: ${launchConfigPath(storageDir)}).`,
    );
  }
  // NOTE: no existsSync() pre-flight on cfg.python / cfg.server. The host runs
  // Node under --permission with fs reads allowed ONLY inside the Extensions
  // dirs, so probing a path in ~/Documents throws "Access to this API has been
  // restricted" — verified live 2026-08-15, where it masqueraded as a config
  // error. The child process is not under that restriction (verified by
  // spawning in an identical sandbox), so a wrong path surfaces as spawn's own
  // ENOENT below, which carries the same information without touching the
  // sandbox.

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (cfg.tonalityRepo) env.TONALITY_REPO = cfg.tonalityRepo;

  // Detached + unref'd: the bridge outlives this host on purpose (see header).
  // stdio ignored: the host's stdio is not ours to fill, and the bridge logs
  // one line per request.
  const child = spawn(cfg.python, [cfg.server], {
    detached: true,
    stdio: "ignore",
    env,
  });
  child.unref();

  let spawnError: Error | null = null;
  child.once("error", (e) => {
    spawnError = e;
  });

  // Bounded readiness wait — criterion 1. Poll rather than sleep-once so a
  // fast machine proceeds fast and a slow one still succeeds.
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (spawnError) break;
    if (await bridgeIsUp(base, 800)) return { outcome: "started" };
    await new Promise((r) => setTimeout(r, 300));
  }
  const se = spawnError as (Error & { code?: string }) | null;
  const why = se
    ? (se.code === "ENOENT"
        ? `the configured python does not exist (${cfg.python})`
        : `spawn failed: ${se.message}`)
    : `it did not answer /health within ${waitMs / 1000}s`;
  throw new Error(
    `Tried to start the Tonality bridge but ${why}.\n` +
      `  ${cfg.python} ${cfg.server}\n` +
      `Try running that by hand to see its output.`,
  );
}
