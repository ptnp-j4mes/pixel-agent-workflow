# Local Agent Runtime Placeholder

This project now includes configuration for a future local small-model agent runtime.

The runtime is intentionally **not active** yet. The UI reads settings from `.env.local` through `app/api/local-agent-config/route.ts`, but no request is sent to Ollama and no model process is started.

## Environment variables

```env
ENABLE_LOCAL_AGENT_RUNTIME=false
OLLAMA_BASE_URL=http://localhost:11434
LOCAL_DEFAULT_MODEL=qwen3:4b

LOCAL_PLANNER_MODEL=qwen3:4b
LOCAL_PLANNER_ENABLED=true
LOCAL_CHAT_MODEL=gemma3:1b
LOCAL_CHAT_ENABLED=true
LOCAL_CODER_MODEL=qwen2.5-coder:3b
LOCAL_CODER_ENABLED=true
LOCAL_CRITIC_MODEL=deepseek-r1:1.5b
LOCAL_CRITIC_ENABLED=true
```

## UI surfaces

- `Settings > Local small agent runtime`
- `Model Console > Local agent runtime`

## Later wiring plan

1. Add an API route such as `/api/local-agent-chat`.
2. Send messages to `OLLAMA_BASE_URL/api/chat` only when explicitly enabled.
3. Persist token usage into the existing Model Console rows.
4. Allow each sprite to choose a local role preset.
5. Add a roundtable endpoint for agent-to-agent conversation.
