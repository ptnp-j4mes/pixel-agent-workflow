# Sprite Agent Autonomy

Sprite agents now have a lightweight local behavior layer before any real API/runtime is connected.

## Runtime role

Each `AgentSprite` can be bound to a role:

- `planner`
- `chat`
- `coder`
- `critic`

The role controls the mock thought pool shown in the pixel speech bubble.

## Casual chat loop

Current placeholder flow:

```txt
user sends chat
  -> sprite enters thinking tone
  -> sprite walks to a random stage point
  -> mock reply is added to Pixel Chat
  -> sprite enters chat tone
  -> autonomous wander continues if enabled
```

## Real runtime integration point

Replace the mock reply inside `sendMessageToSelectedAgent()` in `app/page.tsx` with your runtime call.

Recommended event mapping:

```txt
agent:thinking -> bubbleTone = "thinking"
agent:reply    -> bubbleTone = "chat"
agent:workflow -> bubbleTone = "workflow"
agent:idle     -> bubbleTone = "idle"
```

Keep `autonomy=false` for agents that should stay still unless a workflow or chat event moves them.
