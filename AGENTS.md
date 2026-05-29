# AI Agent Workflow Next.js Project

## Goal
Build and maintain a pixel-art live scene for AI agent workflows. The UI has an 80% scene area and a 20% console area, with draggable sprites, editable workflow nodes, scene objects, background settings, floating panels, model status, and an OpenDesign-style local CLI bridge.

## Commands
- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Build: `npm run build`
- Start production server: `npm run start`
- Detect local CLI engines: `npm run cli:detect`
- Run selected CLI from terminal: `npm run agent:run -- "your prompt"`

## Important files
- Main UI file: `app/page.tsx`
- Global styles: `app/globals.css`
- Agent/pet logic: `app/lib/pets.ts`
- Sprite component: `app/components/AgentPet.tsx`
- Model provider status API: `app/api/model-config/route.ts`
- CLI detection API: `app/api/cli-agents/route.ts`
- CLI execution API: `app/api/cli-run/route.ts`

## Safety
- Never expose API keys to the browser. Only return configured/missing status from server routes.
- Keep `ENABLE_LOCAL_CLI_BRIDGE=false` unless the user explicitly wants local CLI process spawning.
- Preserve Thai UI copy unless the task explicitly asks for English.
