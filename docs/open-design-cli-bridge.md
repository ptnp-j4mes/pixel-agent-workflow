# OpenDesign-style CLI Bridge

This project can use local coding-agent CLIs in the same pattern as OpenDesign: the UI stays local-first, discovers installed CLIs on `PATH`, and sends a prompt to the selected CLI engine.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `ENABLE_LOCAL_CLI_BRIDGE=true` only on a trusted local machine.
3. Pick a default CLI:

```env
CLI_AGENT_DEFAULT=codex
```

Supported defaults include `claude`, `codex`, `gemini`, `opencode`, `qwen`, `deepseek`, `cursor`, and `custom`.

## Detect CLIs

```bash
npm run cli:detect
```

## Run from the UI

Open **Model Console**, choose a CLI engine, then press **Run prompt via CLI**. The UI calls `/api/cli-run`, which spawns the selected command server-side.

## Override command templates

Use `{prompt}` where the current workflow/free-style prompt should be placed.

```env
CODEX_CLI_COMMAND=codex
CODEX_CLI_ARGS=exec {prompt}
GEMINI_CLI_COMMAND=gemini
GEMINI_CLI_ARGS=-p {prompt}
CUSTOM_AGENT_COMMAND=/usr/local/bin/my-agent
CUSTOM_AGENT_ARGS=run --json {prompt}
```

The browser never receives API keys. Provider keys stay in `.env.local`, and the model config API returns only configured/missing status.
