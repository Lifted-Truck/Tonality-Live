/**
 * Tests for bridge auto-start (Q-011). Zero new deps: node:test, a temp dir for
 * the launch config, and a throwaway HTTP server standing in for the bridge.
 * The spawn path uses `process.execPath` (this very node) as the "interpreter"
 * with a tiny script as the "server", so no Python is needed to test the
 * lifecycle logic.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  bridgeIsUp,
  ensureBridge,
  launchConfigPath,
  readLaunchConfig,
  writeLaunchConfig,
} from "./bridgeProcess.js";

const tmp = () => mkdtempSync(join(tmpdir(), "tonality-q011-"));

function fakeBridge(ok: boolean): Promise<{ base: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const srv: Server = createServer((req, res) => {
      if (req.url === "/health") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(ok ? { ok: true, mts: "test" } : { ok: false }));
      } else { res.statusCode = 404; res.end(); }
    });
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      resolve({
        base: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => srv.close(() => r())),
      });
    });
  });
}

// --- config round trip --------------------------------------------------------

test("launch config round-trips through the storage dir", () => {
  const dir = tmp();
  try {
    assert.equal(readLaunchConfig(dir), null, "nothing configured yet");
    const path = writeLaunchConfig(dir, { python: "/py", server: "/srv.py", tonalityRepo: "/repo" });
    assert.equal(path, launchConfigPath(dir));
    assert.deepEqual(readLaunchConfig(dir), { python: "/py", server: "/srv.py", tonalityRepo: "/repo" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a malformed or partial config reads as not-configured, never throws", () => {
  const dir = tmp();
  try {
    writeFileSync(join(dir, "bridge-launch.json"), "{ not json");
    assert.equal(readLaunchConfig(dir), null);
    writeFileSync(join(dir, "bridge-launch.json"), JSON.stringify({ python: "/py" })); // no server
    assert.equal(readLaunchConfig(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("no storage dir means not configured (host may not provide one)", () => {
  assert.equal(readLaunchConfig(undefined), null);
  assert.match(launchConfigPath(undefined), /storageDirectory/);
});

// --- health probe -------------------------------------------------------------

test("bridgeIsUp is true only for {ok:true}", async () => {
  const good = await fakeBridge(true);
  const bad = await fakeBridge(false);
  try {
    assert.equal(await bridgeIsUp(good.base), true);
    assert.equal(await bridgeIsUp(bad.base), false, "{ok:false} is not up");
    assert.equal(await bridgeIsUp("http://127.0.0.1:1"), false, "connection refused is not up");
  } finally { await good.close(); await bad.close(); }
});

// --- ensureBridge lifecycle ---------------------------------------------------

test("criterion 2: never spawns when a bridge is already answering", async () => {
  const b = await fakeBridge(true);
  try {
    // No config at all — if it tried to spawn it would throw "not configured".
    const r = await ensureBridge(b.base, undefined);
    assert.equal(r.outcome, "already");
  } finally { await b.close(); }
});

test("criterion 3: missing config degrades to an actionable message, not a hang", async () => {
  await assert.rejects(
    () => ensureBridge("http://127.0.0.1:1", undefined, 500),
    (e: Error) => /not configured/.test(e.message) && /Set up bridge auto-start/.test(e.message),
  );
});

test("a config pointing at a missing interpreter says so, via spawn's ENOENT", async () => {
  // Deliberately NO existsSync pre-flight: inside the host, Node may not read
  // paths outside the Extensions dirs, so the check itself would throw. The
  // child is unrestricted, so a bad path must surface through spawn instead.
  const dir = tmp();
  try {
    writeLaunchConfig(dir, { python: "/definitely/missing/python", server: "/also/missing.py" });
    await assert.rejects(
      () => ensureBridge("http://127.0.0.1:1", dir, 2000),
      (e: Error) => /does not exist/.test(e.message) && /definitely\/missing\/python/.test(e.message),
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("criterion 1: spawns the configured interpreter and waits for /health", async () => {
  // Stand-in "bridge": this node binary running a script that serves /health.
  // The port is chosen up front so ensureBridge knows where to look.
  const dir = tmp();
  const port = 40000 + Math.floor(Math.random() * 20000);
  const script = join(dir, "fake-server.js");
  writeFileSync(script, `
    const http = require("node:http");
    http.createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, mts: "spawned" }));
    }).listen(${port}, "127.0.0.1");
    // exit on our own after a while so the test never leaks a process
    setTimeout(() => process.exit(0), 4000);
  `);
  writeLaunchConfig(dir, { python: process.execPath, server: script });
  try {
    const r = await ensureBridge(`http://127.0.0.1:${port}`, dir, 5000);
    assert.equal(r.outcome, "started");
    assert.equal(await bridgeIsUp(`http://127.0.0.1:${port}`), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("criterion 1: a spawned process that never answers fails within the bound", async () => {
  const dir = tmp();
  const script = join(dir, "silent.js");
  writeFileSync(script, `setTimeout(() => process.exit(0), 3000);`); // serves nothing
  writeLaunchConfig(dir, { python: process.execPath, server: script });
  const t0 = Date.now();
  try {
    await assert.rejects(
      () => ensureBridge("http://127.0.0.1:1", dir, 1200),
      (e: Error) => /did not answer \/health within/.test(e.message),
    );
    assert.ok(Date.now() - t0 < 4000, "must give up near the bound, not hang");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
