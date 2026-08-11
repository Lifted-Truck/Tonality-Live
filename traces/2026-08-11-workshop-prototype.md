# workshop-prototype — bridge-served workshop, driven end-to-end in a browser

- **Queue item:** Q-004 (in progress). Builds on Q-007 (remap) and the design
  decisions recorded 2026-08-10.
- **Why:** the human asked to see a running prototype. Because the delivery
  decision was "bridge-served during development", the honest way to show it is
  the real page on the real path — not another static mock.
- **What was built:**
  - `bridge/server.py`: `GET /workshop` (serves exactly one file named in code —
    no request-derived path, so there is no traversal surface), `POST /session` +
    `GET /session/<id>` for the clip handoff the dialog cannot do itself, a capped
    in-memory session store, and `GET /session/demo` — a built-in clip so the page
    opens standalone with no Live and no extension attached.
  - `bridge/workshop/index.html`: the workshop. Analysis-only default (Render
    disabled), conform / remap / transpose, live `/analyze` chord strip coloured
    by function, before/after roll with ghost outlines + move connectors,
    out-of-scale marking, refusal overlay, Web Audio audition with playhead.
- **Both portability rules honoured (they are what keeps the data:-URL option
  open):** one `loadInput()` seam is the only code that knows where the clip came
  from, and `BASE` is injected by the server, never read from `location.origin`.
- **Bug found by running it, not by reading it:** `/analyze` failed with a CORS
  error. The page was served from `localhost:8765` while `BASE` was injected as
  `127.0.0.1:8765` — different origins — and a JSON POST preflights. The server
  had no `do_OPTIONS`, so the preflight 404'd. Two fixes, both wanted:
  1. `do_OPTIONS` returning the CORS headers. **Not optional**: a data:-delivered
     workshop has an opaque origin, so every POST it makes is cross-origin and
     preflighted. Without this the fallback delivery mode could never work.
  2. Inject the base from the request's `Host` so served mode is same-origin and
     never preflights. The Host header is attacker-influenced in general and this
     value becomes the page's fetch base, so it is accepted only when it matches
     a loopback name; otherwise we fall back to our configured address.
- **Verified in the browser against the live engine:** detected key `C major`
  margin 0.21; chord strip populated (C maj / A min / F majadd9 / G maj with
  tonic-predominant-dominant colouring); translate to C Dorian → **4 moved, 16
  unchanged** with ghosts showing E→D♯ and B→A♯ (degrees 3 and 7 — exactly what
  degree-preserving translation should do); 7→5 remap → refusal overlay carrying
  the engine's own reason plus "use Clean up / constrain instead"; out-of-scale
  marking against the detected key → the 2 chromatic notes highlighted, "2 out of
  scale"; Render correctly enabled only when a transformation is selected.
- **Display bug fixed while driving it:** the summary showed `G#→G#`. remap emits
  an edit for every chromatic note — recording its *degree attachment*, not
  necessarily a move — so edits where `from_midi == to_midi` are now filtered out
  of the display.
- **Alternatives rejected:** publish another Artifact mockup (an Artifact's CSP
  blocks localhost, so it could only ever show precomputed data — the whole point
  now is that it is live); build the extension command first (the delivery
  mechanism was the open question, and it is answerable without Live).
- **Verify:** `./verify full` exit 0 against a live bridge — 27 bridge tests,
  `/health` + `/analyze` + `/transform` (conform, remap walk-preservation, 7→5
  refusal). The workshop routes themselves have **no automated coverage yet** —
  see open questions.
- **Open questions:** no tests for `/workshop`, `/session`, or the page's JS
  (same untestable-inline-JS gap as Q-005's dialog; worth a harness once the
  shape settles). The extension side is not wired — no command, no session
  handoff from a real clip, so nothing in Live changed. Declared-vs-detected
  (Q-008a) needs the extension to pass Live's scale in, and `/analyze` to return
  the detected key's degrees.
