# API model ↔ CLI config dialog

This build adds a detailed settings dialog focused on keeping API provider settings aligned with the local CLI engine used by the OpenDesign-style bridge.

## Provider pairs

| API provider | API env | Model env | Matching CLI | CLI command env | CLI args env |
|---|---|---|---|---|---|
| Google Gemini | `GOOGLE_API_KEY` | `GOOGLE_MODEL` | Gemini CLI | `GEMINI_CLI_COMMAND` | `GEMINI_CLI_ARGS` |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` | DeepSeek TUI | `DEEPSEEK_CLI_COMMAND` | `DEEPSEEK_CLI_ARGS` |
| Qwen | `QWEN_API_KEY` | `QWEN_MODEL` | Qwen Code | `QWEN_CLI_COMMAND` | `QWEN_CLI_ARGS` |
| OpenAI / Codex | `OPENAI_API_KEY` | `CODEX_MODEL` | Codex CLI | `CODEX_CLI_COMMAND` | `CODEX_CLI_ARGS` |

## Where to open it

- `Model Console` → **Config dialog**
- `Settings` → **API model ↔ CLI settings** → **Config dialog**

## What it does now

- Reads provider status from `/api/model-config`.
- Reads CLI detection from `/api/cli-agents`.
- Selects the matching CLI when an API provider is selected.
- Shows `.env.local` preview for the selected API + CLI pair.
- Does not reveal raw API keys to the browser.

## What it does not do yet

The dialog is configuration-first. It does not write `.env.local` automatically from the browser. Users still copy values into `.env.local` manually.
