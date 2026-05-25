# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

AI 口译训练平台 — a browser-based Chinese-English interpreting training tool. The project was originally designed as a Python/Gradio multi-module system (see README.md for the original architecture plan), but has since been rewritten as a **pure frontend single-file application** with no backend, no build step, and no dependencies.

## How to run

Open `interpreter_v2.html` directly in Chrome or Edge (required for Web Speech API support):

```bash
start "" "interpreter_v2.html"
```

There is no dev server, no build tool, and no package manager. The file is self-contained.

## Architecture

`interpreter_v2.html` (~102KB, ~1350 lines) contains everything: HTML structure, CSS styles, and all JavaScript logic in a single file. It uses only browser-native APIs — no frameworks, no libraries.

**Three-tab SPA structure:**

1. **AI 翻译机 (Translation Demo)** — Text or voice input → MyMemory API translation (free tier, falls back to LibreTranslate) → TTS playback via SpeechSynthesis API. Supports bidirectional Chinese ↔ English.
2. **实战演练 (Practice Mode)** — Pulls a random item from an embedded 174-item material library (3 difficulty levels × 29 items each, stored as JS objects `MATERIALS` and `MATERIALS_REVERSE` in the script). User records their translation → Web Speech API STT → local scoring engine compares against reference via Jaccard + bigram character similarity → 3-dimension score (pronunciation, fluency, accuracy, each 0–3) → saves to localStorage.
3. **学习记录 (Learning Records)** — Reads practice history from localStorage, displays stats panel, sortable table, detail modal, CSV export.

**External API calls (no auth required):**
- MyMemory translation API: `https://api.mymemory.translated.net/get`
- LibreTranslate fallback: `https://libretranslate.com/translate`

**Browser APIs used:** Web Speech API (SpeechRecognition + SpeechSynthesis), MediaRecorder API, localStorage.

## Repository structure

| Path | Purpose |
|------|---------|
| `interpreter_v2.html` | **Main application** (current, actively developed) |
| `integrated_ui.html` | V1 prototype (superseded) |
| `src/Front-end/` | Copies of the HTML files and documentation guides |
| `.env` | API keys for DashScope and Google Translate (unused by current frontend; gitignored) |
| `README.md` | Original Python/Gradio architecture plan (outdated — describes a 6-person, 5-week workflow that no longer applies) |
| `instructions.txt` | Legacy venv/pip setup notes (obsolete) |
| `uploads/` | Empty directory |
| `venv/` | Residual Python virtual environment |
| `.kiro/specs/` | Formal 18-requirement specification for the platform |

## Key technical notes

- The **material library** (`MATERIALS` and `MATERIALS_REVERSE` objects) contains 174 bilingual entries hardcoded in the `<script>` tag. `MATERIALS` is English→Chinese, `MATERIALS_REVERSE` is Chinese→English. Each has `easy`, `medium`, `hard` arrays.
- The **scoring engine** is purely client-side: Jaccard similarity on character trigrams + bigram sequence comparison. No LLM is involved in scoring (the original README planned LLM-based scoring, but the implementation uses local text similarity).
- Speech recognition uses the browser's built-in `webkitSpeechRecognition` — this only works in Chrome/Edge and requires `lang` to be set dynamically based on the translation direction.
- The `.env` file with DashScope/Google Translate keys is **not used** by the current frontend-only implementation.

## Git workflow

Current branch is `worktree`. Main branch is `main`. The remote has additional branches: `src`, `version-bychl`.
