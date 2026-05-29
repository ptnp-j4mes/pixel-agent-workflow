# ▣ Pixel Agent Workflow

```txt
██████╗ ██╗██╗  ██╗███████╗██╗         █████╗  ██████╗ ███████╗███╗   ██╗████████╗
██╔══██╗██║╚██╗██╔╝██╔════╝██║        ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
██████╔╝██║ ╚███╔╝ █████╗  ██║        ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║
██╔═══╝ ██║ ██╔██╗ ██╔══╝  ██║        ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║
██║     ██║██╔╝ ██╗███████╗███████╗   ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║
╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝
```

**Pixel Agent Workflow** คือ Next.js playground สำหรับทำ **AI agent workflow แบบ live scene**: มี sprite agent เดินในฉาก, workflow bubble, scene objects, pixel chat, model console, API/CLI config และ local runtime settings สำหรับต่อยอดเป็น agent workspace จริง

> Status: prototype / playground — API, CLI และ local runtime หลายส่วนเตรียม config ไว้แล้ว แต่บางส่วนยังเป็น mock/placeholder เพื่อให้ทดลอง UI flow ได้ปลอดภัยก่อนต่อ runtime จริง

---

## ✦ Feature Map

```txt
┌─────────────────────────────── Live Scene 80% ───────────────────────────────┐
│  Pixel background  · draggable sprite agents · workflow bubbles · objects     │
│  floating panels   · topbar controls       · editable prompt frame            │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
┌──────────────────────────── Menu / Console 20% ──────────────────────────────┐
│  Agent Console · Pixel Chat · Flow Editor · Scene Editor · Settings · Logs    │
│  Model Console · API ↔ CLI config · token usage · local runtime placeholder   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Sprite Agents

- ผูก sprite เข้ากับ agent role ได้ เช่น `Planner`, `Casual Chat`, `Coder`, `Critic`
- Sprite เดินเองแบบ wander ได้
- เมื่อคุยเล่นผ่าน Pixel Chat จะเข้าสู่ state **thinking → reply → wander**
- Bubble บนหัว agent เป็น pixel speech bubble พร้อม tone:
  - `idle`
  - `thinking`
  - `chat`
  - `workflow`
- Drag sprite ไปวางตำแหน่งเองได้
- เลือก pet asset / runtime role / autonomy ต่อ sprite ได้จาก Agent Console

### Scene Editor

- เปลี่ยน background ได้
- fit/contain/stretch และ zoom background ได้
- เพิ่ม object เช่น desk ลง scene ได้
- object อยู่ layer สูงกว่า sprite เพื่อให้ sprite เดินหลังโต๊ะได้
- desk/object ลาก, resize, rotate และบันทึก layout ลง `localStorage`

### Workflow Editor

- Workflow node เป็น pixel bubble
- ลาก workflow node ใน scene ได้
- เพิ่ม/ลบ/reorder step ได้
- Progress workflow panel เปิด/ซ่อน/ลาก/resize ได้
- Prompt frame เปิด/ซ่อน/collapse/resize/ลากได้

### Model + CLI Console

- แสดง API provider ↔ CLI engine mapping
- มี detailed config dialog สำหรับ Google Gemini, DeepSeek, Qwen และ OpenAI/Codex
- อ่านสถานะ config จาก `.env.local` แบบไม่ expose API key จริงไป client
- รองรับ OpenDesign-style local CLI bridge แบบปิดไว้ก่อน
- มี local small-model runtime settings placeholder เช่น Ollama + Qwen/Gemma/DeepSeek roles

---

## ▣ Quick Start

```bash
npm install
npm run dev
```

เปิดเว็บ:

```txt
http://localhost:3000
```

ถ้าจะใช้ config model/CLI:

```bash
cp .env.example .env.local
npm run cli:detect
npm run dev
```

---

## ▣ Environment Config

ตัวอย่าง `.env.local`:

```env
# API providers
GOOGLE_API_KEY=
GOOGLE_API_BASE_URL=https://generativelanguage.googleapis.com
GOOGLE_MODEL=gemini-2.5-pro

DEEPSEEK_API_KEY=
DEEPSEEK_API_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

QWEN_API_KEY=
QWEN_API_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus

OPENAI_API_KEY=
OPENAI_MODEL=codex-cli

# CLI bridge is locked by default
ENABLE_LOCAL_CLI_BRIDGE=false
CLI_AGENT_DEFAULT=codex

# Local runtime placeholder
ENABLE_LOCAL_AGENT_RUNTIME=false
OLLAMA_BASE_URL=http://localhost:11434
LOCAL_PLANNER_MODEL=qwen3:4b
LOCAL_CHAT_MODEL=gemma3:1b
LOCAL_CODER_MODEL=qwen2.5-coder:3b
LOCAL_CRITIC_MODEL=deepseek-r1:1.5b
```

---

## ▣ Project Structure

```txt
app/
  page.tsx                       # live scene, panels, workflow, agent UI
  globals.css                    # pixel UI, sprite animation, scene layers
  layout.tsx                     # fonts
  components/
    AgentPet.tsx                 # draggable sprite + pixel speech bubble
    PixelChat.tsx                # chat panel
    PixelIcon.tsx                # SVG icon loader
  config/
    setting-config.json          # scene layers + default layout config
  lib/
    pets.ts                      # agent/sprite types and helpers
  api/
    model-config/route.ts        # model env status
    cli-agents/route.ts          # CLI detection config
    cli-run/route.ts             # local CLI bridge
    local-agent-config/route.ts  # local runtime placeholder config
public/
  backgrounds/
  icons/pixel/
  objects/desks/
  pets/
  examples/
docs/
  api-cli-config-dialog.md
  local-agent-runtime-placeholder.md
  open-design-cli-bridge.md
  pet-import-format.md
  setting-config.md
scripts/
  detect-cli-agents.mjs
  run-agent-cli.mjs
```

---

## ▣ Import Sprite Format

สร้าง `.zip` ที่มีไฟล์อย่างน้อย:

```txt
pet.json
spritesheet.webp
```

ตัวอย่าง `pet.json`:

```json
{
  "id": "my-pet",
  "displayName": "My Pet",
  "description": "Custom Codex Pet sprite",
  "spritesheetPath": "spritesheet.webp",
  "kind": "person",
  "columns": 8,
  "rows": 9,
  "frameWidth": 192,
  "frameHeight": 208,
  "animation": {
    "idleRow": 0,
    "runRightRow": 1,
    "runLeftRow": 2,
    "idleFrames": 6,
    "runFrames": 8
  }
}
```

---

## ▣ Agent Autonomy Placeholder

ตอนนี้ sprite agent มี local behavior แบบ mock:

```txt
chat message → agent thinking bubble → mock reply → wander to new point
idle agent   → periodic thought       → wander around scene
workflow     → follow workflow node    → show workflow bubble tone
```

จุดต่อ runtime จริงอยู่ที่:

```txt
sendMessageToSelectedAgent()
runPromptWithSelectedCli()
app/api/cli-run/route.ts
app/api/local-agent-config/route.ts
```

---

## ▣ GitHub Topics

```txt
nextjs ai-agents workflow pixel-art sprites agent-ui local-ai ollama cli-agents model-console
```

---

## License

MIT — ใช้ต่อยอดเป็น playground หรือ internal agent UI ได้อิสระ
