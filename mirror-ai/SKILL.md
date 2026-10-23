---
name: mirror-ai
description: >-
  Runs Mirror AI — the local Android vs iOS comparison UI (module enum or
  whole-repo audits, business logic, UI, and API contract drift from code).
  Use for /mirror-ai, starting Mirror AI, opening the comparison UI, running
  audits, packaging the portable zip, or troubleshooting setup.
disable-model-invocation: true
---

# Mirror AI

Mirror AI is a **local Node app** that clones two git repos, compares Android
and iOS, and runs Claude audits. It is **not** installed via npm globally — the
user works from a project folder (or the portable zip).

## When to use

- User says **/mirror-ai**, **start Mirror AI**, **open Mirror UI**, or **run comparison**
- User wants **module-by-enum** audits or **whole codebase** mode (toggle off “Scope by module enum”)
- User needs **setup help**, **package for sharing**, or **PDF export** from the report

## Locate the project

Find the folder whose `package.json` has `"name": "mirror-ai"`. Common paths:

- Unzipped `distribution/Mirror-AI`
- `Cursor Tools/Mirror AI` on the user’s machine

If the workspace is not that folder, `cd` there before any command below.

## Start the UI

```bash
chmod +x scripts/start-ui.sh
./scripts/start-ui.sh
```

Tell the user:

- URL: **http://127.0.0.1:4173/** (or `PORT` from `.env`)
- Logs: `.cache/mirror-ai-serve.log`
- Stop: `kill $(cat .cache/mirror-ai-serve.pid)`

Do **not** start a second server if the script says it is already running.

## Using the UI (brief)

| Mode | User action |
|------|-------------|
| **By module** | Leave “Scope by module enum” **on** → List modules → tick modules → Find differences |
| **Whole app** | Turn scope **off** → Compare entire codebase (audit starts after repos connect) |
| **PDF** | When the report is visible, **Download PDF** (top right of Differences) |

Audits need **Claude Code CLI** (`claude login`) or **`ANTHROPIC_API_KEY`** + `MIRROR_AI_RUNNER=api` in `.env`.

## Package portable zip (share with teammates)

From project root:

```bash
chmod +x scripts/package-for-sharing.sh
./scripts/package-for-sharing.sh
```

Output: `distribution/Mirror-AI/` and `distribution/Mirror-AI.zip`.

## Setup on a new machine

```bash
chmod +x setup.sh && ./setup.sh
```

Node **22+** required. If start fails, run `./scripts/diagnose-setup.sh` or use the project skill **find-setup-issue**.

## Do not

- Log or commit `.env`, tokens, or API keys
- Paste full audit reports containing secrets into chat
- Modify app source unless fixing a clear startup/environment issue the user asked for

## Manual server

```bash
npm install
npm run serve
```

Open http://127.0.0.1:4173/ (or configured `PORT`).
