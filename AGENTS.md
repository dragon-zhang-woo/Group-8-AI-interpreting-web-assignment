# AGENTS.md

This file provides guidance to Codex when working in this repository.

## Project Overview

AI 口译训练平台 is currently centered on `interpreter_v4`, a browser-based Chinese-English language transcoding training site. Earlier Python / Gradio plans and the old `interpreter_v2.html` single-file prototype are historical references only.

The current app is still pure frontend: no backend, no build step, no package manager requirement. It uses ES modules and loads JSON data with `fetch()`, so it should be served over local HTTP instead of opened directly from the filesystem.

## How To Run

```bash
cd interpreter_v4
python -m http.server 8084
```

Then open Chrome or Edge at:

```text
http://localhost:8084
```

Chrome / Edge are recommended because recording, speech recognition, and speech synthesis depend on browser Web Speech APIs.

## Current V4 Architecture

`interpreter_v4/` is the active implementation.

- `index.html`: SPA shell with training desk, workspace, expert conversation, records, and settings.
- `styles/main.css`: responsive UI, custom select menus, rule tree, cards, records, and modal styling.
- `data/transcoding-rules.json`: six knowledge modules and seven local diagnostic rule types.
- `data/materials.json`: 132原创 bilingual practice materials with direction, difficulty, module, and focus rules.
- `js/main.js`: application orchestration and UI state.
- `js/components/TranscodingFeedbackEngine.js`: local rule-based diagnostic engine.
- `js/components/MaterialLibrary.js`: material loading and multi-rule random selection.
- `js/components/RecordManager.js`: IndexedDB record persistence and CSV export.
- `js/services/`: optional translation, AI feedback enhancement, and speech services.
- `tests/feedback-engine.test.mjs`: local rule, AI fallback, expert intent, material coverage, and multi-rule selection tests.

## Product Behavior Notes

- Core goal: Chinese-English language transcoding, not generic machine translation.
- Main surfaces: training desk, practice workspace, expert conversation, and learning records.
- The workspace rule tree supports multi-selection:
  - one selected rule = targeted practice;
  - multiple selected rules = comprehensive practice.
- Expert conversation supports direct source-text feedback and guided practice requests such as `我想练中→英，文化负载词，综合难度`.
- Learning records store both the selected training rules and the actually triggered diagnostic rules.

## Data And Browser APIs

- Settings and session drafts are stored in `localStorage` with the `int4_` prefix.
- Learning records and audio blobs are stored in IndexedDB.
- Recording uses MediaRecorder.
- Speech recognition and speech synthesis use browser Web Speech APIs.
- Optional machine translation uses DeepL when configured, otherwise MyMemory / LibreTranslate fallback.
- Optional AI feedback enhancement accepts OpenAI-compatible `/v1/chat/completions` endpoints. Local rule feedback must remain usable without an API key.

## Test Commands

```bash
cd interpreter_v4
node tests/feedback-engine.test.mjs
node --check js/main.js
node --check js/components/TranscodingFeedbackEngine.js
node --check js/components/ExpertConversation.js
node --check js/components/MaterialLibrary.js
node --check js/components/RecordManager.js
```

The test suite intentionally triggers one invalid AI endpoint to verify local fallback; the resulting console warning is expected when the command exits successfully.

## Historical Files

- `interpreter_v2.html`, `integrated_ui.html`, and `src/Front-end/` are earlier prototypes or copies.
- `venv/`, `uploads/`, and legacy setup notes are not required for running V4.
- Treat old README or setup instructions that mention Python / Gradio runtime modules as historical unless the user explicitly asks to inspect legacy versions.
