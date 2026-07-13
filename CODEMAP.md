# CODEMAP — Tonality-Live

Where things live. Two subsystems behind one HTTP contract; the music theory
is in a third repo (Tonality/`mts`), never here.

```
Tonality-Live/
├── extension/                  # the .ablx — TypeScript, loaded by Live at EDIT time
│   ├── src/
│   │   ├── extension.ts        # activate(): registers context-menu commands
│   │   │                       #   tonality.analyzeClip / tonality.transpose
│   │   ├── bridge.ts           # HTTP client for the bridge (analyze()); types
│   │   ├── transform.ts        # transpose() — the ONLY local note transform
│   │   └── html.d.ts           # lets *.html be imported as strings
│   ├── ui/
│   │   ├── analysis.html       # analysis dialog (payload inlined at __TONALITY_PAYLOAD__)
│   │   └── transpose.html      # transpose prompt (returns {semitones})
│   ├── build.ts                # esbuild bundler (invoked by npm run build)
│   ├── manifest.json           # extension manifest (PROTECTED — public identity)
│   ├── package.json            # scripts: build / build:dev / start / package
│   └── vendor/*.tgz            # beta SDK+CLI — PROTECTED, gitignored, non-redistributable
│
├── bridge/                     # local HTTP service — stdlib + mts only, no third-party deps
│   ├── server.py               # /health, /analyze (wraps mts midi_file_analysis), /transform (501 seam)
│   └── README.md               # run + endpoints + the /transform seam
│
├── CLAUDE.md ROADMAP.md DECISIONS.md   # charter / SSOT / settled decisions
├── INDEX.md LIBRARY.md                 # knowledge loop (retrieval map / lessons)
├── CODEMAP.md project.manifest.json    # this file / survey answers
├── verify                              # oracle: fast | full | report
├── traces/                             # append-only per-change decision log
└── .claude/                            # agents, hooks, settings, provenance skill
```

**The data path:** Live → `extension/` reads `clip.notes` → POST to
`bridge/` → rebuilds a Tonality `Sequence`, runs `mts` analysis → JSON back →
dialog. Canonical data at the boundary is pitch-class / MIDI integers;
spelling/labels are rendered at the edge (INTEGRATIONS rule 8).
