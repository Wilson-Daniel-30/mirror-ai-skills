# Mirror AI — Quickstart

## Prerequisites

- **Node.js 22+** (needs `--experimental-strip-types`; Node 20.12+ if you only use `.env` loading)
- **npm** (bundled with Node)
- **git** (to clone remote Android/iOS repos into `.cache/repos/`)
- **Claude Code CLI** (`claude`) *or* an **Anthropic API key** for audits
- **macOS** (recommended): full feature set including iOS screenshot renders
- **Linux / Windows**: web UI, static compare, and audits work; iOS screenshots require macOS + Xcode

## Get the project

```bash
git clone <your-mirror-ai-repo-url> mirror-ai
cd mirror-ai
```

Or unzip a shared folder, then `cd` into it.

## Setup

**macOS / Linux:**

```bash
chmod +x setup.sh
./setup.sh
```

**Windows (PowerShell):**

```powershell
.\setup.ps1
```

## Required configuration

| Situation | What you need |
|-----------|----------------|
| `claude` CLI installed and logged in | Nothing else for audits (default runner) |
| No Claude Code CLI | `ANTHROPIC_API_KEY` in `.env` and optionally `MIRROR_AI_RUNNER=api` |
| Private Bitbucket URLs | `BITBUCKET_USERNAME` + `BITBUCKET_TOKEN` in `.env`, or configure git credentials |

Copy the template if the installer did not create `.env`:

```bash
cp .env.example .env
```

## Launch

```bash
npm run serve
```

Open the URL printed in the terminal (default **http://127.0.0.1:4173/**).

## Verify

```bash
npm test
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4173/   # expect 200 while serve is running
```

Full details: [README.md](README.md).
