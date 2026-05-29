"use client";

import JSZip from "jszip";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent } from "react";
import { AgentPet } from "./components/AgentPet";
import { PixelChat, type PixelChatMessage } from "./components/PixelChat";
import { PixelIcon } from "./components/PixelIcon";
import settingConfigJson from "./config/setting-config.json";
import {
  type AgentMode,
  type AgentRuntimeRole,
  type AgentSprite,
  builtInPets,
  clampPosition,
  createAgentSprite,
  DEFAULT_ANIMATION,
  type PetAsset,
  randomStagePoint
} from "./lib/pets";

type WorkflowStep = {
  id: string;
  title: string;
  label: string;
  description: string;
  x: number;
  y: number;
  accent: string;
  status: string;
};

type SceneObject = {
  id: string;
  type: "desk" | "table" | "note" | "portal" | "terminal";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  imageSrc?: string;
  rotation: number;
};

type AgentLog = {
  time: string;
  label: string;
  detail: string;
};

type SceneBackground = {
  id: string;
  name: string;
  src: string;
  source: "built-in" | "imported";
};

type BackgroundFit = "cover" | "contain" | "stretch";

type WorkflowDockFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FloatingPanelFrame = WorkflowDockFrame & {
  visible: boolean;
  collapsed: boolean;
};

type FloatingPanelKind = "memory" | "workflow" | "progress";
type SceneButtonKey = "editScene" | "memory" | "workflow" | "progress" | "freeRoam" | "runPause" | "workflowToggle" | "topbarToggle";
type SceneButtonFrame = { x: number; y: number };

type ConsoleMode = "agent" | "model";
type ModelConfigDialogTab = "api" | "cli" | "env";

type ModelProviderConfig = {
  id: "google" | "deepseek" | "qwen" | "codex";
  name: string;
  envKey: string;
  baseUrl?: string;
  baseUrlEnv: string;
  modelEnv: string;
  defaultModel: string;
  cliId: string;
  requestStyle: string;
  apiKeyStatus: "configured" | "missing";
  enabled: boolean;
};

type ModelConfigResponse = {
  providers: ModelProviderConfig[];
  selectedProviderId: ModelProviderConfig["id"];
  codexCliEnabled: boolean;
};

type CliToolConfig = {
  id: string;
  name: string;
  command: string;
  commandEnv: string;
  argsEnv: string;
  argsPreview: string;
  providerHint: string;
  installed: boolean;
  enabled: boolean;
};

type CliAgentConfigResponse = {
  localBridgeEnabled: boolean;
  selectedCliId: string;
  tools: CliToolConfig[];
};

type CliRunResponse = {
  ok: boolean;
  cliId?: string;
  cliName?: string;
  commandLabel?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  durationMs?: number;
  skipped?: boolean;
  error?: string;
};

type TokenUsageRow = {
  agentId: string;
  agentName: string;
  providerId: ModelProviderConfig["id"];
  providerName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  lastRun: string;
};

type LocalAgentRoleConfig = {
  id: "planner" | "chat" | "coder" | "critic";
  label: string;
  envKey: string;
  model: string;
  description: string;
  enabled: boolean;
};

type LocalAgentRuntimeConfig = {
  provider: "ollama";
  providerLabel: string;
  enabled: boolean;
  readyForUse: boolean;
  baseUrl: string;
  baseUrlEnv: string;
  baseUrlStatus: "default" | "configured";
  defaultModel: string;
  roles: LocalAgentRoleConfig[];
  executionMode: "settings-only";
};

type SavedSceneLayout = {
  workflowSteps?: WorkflowStep[];
  sceneObjects?: SceneObject[];
  agents?: AgentSprite[];
  workflowDockFrame?: WorkflowDockFrame;
  isWorkflowDockVisible?: boolean;
  isWorkflowDockCollapsed?: boolean;
  memoryContextPanel?: FloatingPanelFrame;
  workflowMapPanel?: FloatingPanelFrame;
  progressPanel?: FloatingPanelFrame;
  topHudPanel?: FloatingPanelFrame;
  sceneButtonFrames?: Partial<Record<SceneButtonKey, SceneButtonFrame>>;
  activeBackgroundId?: string;
  backgroundFit?: BackgroundFit;
  backgroundZoom?: number;
};

type ImportedPetJson = {
  id?: string;
  displayName?: string;
  description?: string;
  spritesheetPath?: string;
  kind?: string;
  columns?: number;
  rows?: number;
  frameWidth?: number;
  frameHeight?: number;
  animation?: Partial<typeof DEFAULT_ANIMATION>;
};

type MenuTab = "chat" | "agents" | "workflow" | "scene" | "settings" | "logs";
type SceneMode = "play" | "edit";

type SettingConfig = {
  schemaVersion: number;
  storageKey: string;
  sceneLayers: {
    background: number;
    ambient: number;
    workflowEdges: number;
    sprites: number;
    workflowMarkers: number;
    workflowControls: number;
    objects: number;
    hud: number;
    floatingPanels: number;
  };
  workflowEditor: {
    style: string;
    bubbleCards: boolean;
    showStepTail: boolean;
    compactNodeList: boolean;
  };
  defaults: {
    workflowDockFrame: WorkflowDockFrame;
    panels: {
      memoryContext: FloatingPanelFrame;
      workflowMap: FloatingPanelFrame;
      progress: FloatingPanelFrame;
      topHud: FloatingPanelFrame;
    };
    sceneButtonFrames: Record<SceneButtonKey, SceneButtonFrame>;
  };
};

const settingConfig = settingConfigJson as unknown as SettingConfig;

const initialWorkflowSteps: WorkflowStep[] = [
  {
    id: "prompt",
    title: "Prompt Intake",
    label: "รับโจทย์",
    description: "รับคำสั่งจากผู้ใช้ แยก intent, goal, constraints และ output format",
    x: 18,
    y: 66,
    accent: "#37d5ff",
    status: "กำลังอ่านโจทย์และแยกเป้าหมาย"
  },
  {
    id: "planner",
    title: "Planner",
    label: "วางแผน",
    description: "แตกงานเป็น sub-task แล้วจัดลำดับขั้นตอนให้ agent ทำงานแบบตรวจสอบย้อนกลับได้",
    x: 30,
    y: 54,
    accent: "#8c7bff",
    status: "กำลังสร้างแผนงาน"
  },
  {
    id: "router",
    title: "Tool Router",
    label: "เลือกเครื่องมือ",
    description: "เลือกว่าจะใช้ search, database, API, code runner หรือ handoff ให้ worker agent",
    x: 48,
    y: 58,
    accent: "#ffce5c",
    status: "กำลังเลือก tool ที่เหมาะที่สุด"
  },
  {
    id: "workers",
    title: "Worker Agents",
    label: "ทีมย่อย",
    description: "ให้ agent เฉพาะทางลงมือทำ เช่น research, coding, QA, summarization",
    x: 65,
    y: 55,
    accent: "#ff7aa8",
    status: "กำลังประมวลผล task ย่อย"
  },
  {
    id: "memory",
    title: "Memory + Context",
    label: "ความจำ",
    description: "ดึง context ที่เกี่ยวข้อง เก็บผลลัพธ์ระหว่างทาง และลดข้อมูลซ้ำก่อนส่งต่อ",
    x: 76,
    y: 69,
    accent: "#60ffa8",
    status: "กำลัง sync context"
  },
  {
    id: "guardrail",
    title: "Guardrail Check",
    label: "ตรวจคุณภาพ",
    description: "เช็ก policy, hallucination risk, source coverage และความครบถ้วนของคำตอบ",
    x: 58,
    y: 75,
    accent: "#ff8b4d",
    status: "กำลัง verify ผลลัพธ์"
  },
  {
    id: "output",
    title: "Final Output",
    label: "ส่งคำตอบ",
    description: "จัดรูปแบบคำตอบสุดท้ายให้ใช้งานง่าย พร้อม reasoning summary และ next action",
    x: 38,
    y: 74,
    accent: "#77e8ff",
    status: "กำลังจัดรูปแบบคำตอบสุดท้าย"
  }
];

const initialSceneObjects: SceneObject[] = [
  {
    id: "object-manager-desk",
    type: "desk",
    label: "Manager Desk",
    x: 63,
    y: 74,
    width: 30,
    height: 15,
    color: "#ffce5c",
    imageSrc: "/objects/desks/manager_desk_transparent.png",
    rotation: 0
  },
  {
    id: "object-developer-desk",
    type: "desk",
    label: "Developer Desk",
    x: 38,
    y: 78,
    width: 24,
    height: 13,
    color: "#42d9ff",
    imageSrc: "/objects/desks/developer_desk_transparent.png",
    rotation: 0
  },
  {
    id: "object-memory-note",
    type: "note",
    label: "Memory Note",
    x: 77,
    y: 47,
    width: 10,
    height: 7,
    color: "#60ffa8",
    rotation: -2
  }
];

const baseLogs: AgentLog[] = [
  { time: "00:01", label: "Scene", detail: "Live scene แสดงเต็มจอ แบ่งพื้นที่ screen 80% และ menu 20%" },
  { time: "00:03", label: "Pixel chat", detail: "คลิก sprite เพื่อเลือก agent และเปิด chat ได้ทันที" },
  { time: "00:06", label: "Edit mode", detail: "ลาก workflow node / object และกด + บนเส้นเพื่อเพิ่ม workflow step ได้" }
];

const agentColors = ["#42d9ff", "#ff7aa8", "#60ffa8", "#ffce5c", "#9b8cff", "#ff8b4d"];

const agentRuntimeRoleLabels: Record<AgentRuntimeRole, string> = {
  planner: "Planner",
  chat: "Casual Chat",
  coder: "Coder",
  critic: "Critic"
};

const agentThoughtPools: Record<AgentRuntimeRole, string[]> = {
  planner: [
    "กำลังแตก goal เป็น step เล็ก ๆ",
    "คิด route ถัดไปให้ workflow",
    "วางลำดับ task ก่อนส่งต่อ",
    "เช็กว่า step ไหนควรทำก่อน"
  ],
  chat: [
    "เดินเล่นและรอคุยด้วย",
    "มองหา topic สนุก ๆ",
    "พร้อมคุย casual ได้เลย",
    "กำลังฟังบรรยากาศใน scene"
  ],
  coder: [
    "คิด component ที่ควรแยก",
    "เช็ก edge case ของ UI",
    "มองหาไฟล์ที่ต้องแก้ต่อ",
    "คิดวิธี plug runtime แบบสะอาด"
  ],
  critic: [
    "กำลังหา risk ที่ซ่อนอยู่",
    "ตรวจคุณภาพคำตอบก่อนส่ง",
    "เช็กว่ามี context พอไหม",
    "กำลังหา hallucination gap"
  ]
};

const casualReplyTemplates = [
  "รับแล้ว เดี๋ยวเดินคิดให้ก่อนนะ",
  "โอเค! ฉันจะช่วยมองมุม agent ให้",
  "ได้เลย กำลังเก็บ context จาก scene",
  "น่าสนใจมาก เดี๋ยวลองคิดเป็น step ให้"
];
const workflowColors = ["#37d5ff", "#8c7bff", "#ffce5c", "#ff7aa8", "#60ffa8", "#ff8b4d", "#77e8ff"];

const initialBackgrounds: SceneBackground[] = [
  { id: "manager-office", name: "Manager Office", src: "/backgrounds/manager-office.png", source: "built-in" },
  { id: "piak-dev-office", name: "PIAK Dev Office", src: "/backgrounds/bg-office-piak-dev.png", source: "built-in" }
];

const tabLabels: Record<MenuTab, string> = {
  chat: "Chat",
  agents: "Agents",
  workflow: "Flow",
  scene: "Scene",
  settings: "Settings",
  logs: "Logs"
};

const tabIcons: Record<MenuTab, string> = {
  chat: "paperplane",
  agents: "sparkles",
  workflow: "line",
  scene: "grid",
  settings: "wrench",
  logs: "list"
};

const iconPreview = ["paperplane", "sparkles", "folder", "database", "command", "home", "image", "images", "wrench", "bell", "play", "pause", "plus", "list"];

const backgroundFitLabels: Record<BackgroundFit, { label: string; detail: string }> = {
  cover: { label: "Cover", detail: "เต็มจอ อาจ crop ขอบภาพ" },
  contain: { label: "Contain", detail: "แสดงภาพครบ มีขอบว่างได้" },
  stretch: { label: "Stretch", detail: "บีบ/ยืดให้เต็มกรอบ เห็นครบทุกส่วน" }
};

const SCENE_STORAGE_KEY = settingConfig.storageKey;

const defaultModelConfig: ModelConfigResponse = {
  selectedProviderId: "google",
  codexCliEnabled: false,
  providers: [
    { id: "google", name: "Google Gemini", envKey: "GOOGLE_API_KEY", baseUrl: "https://generativelanguage.googleapis.com", baseUrlEnv: "GOOGLE_API_BASE_URL", modelEnv: "GOOGLE_MODEL", defaultModel: "gemini-2.5-pro", cliId: "gemini", requestStyle: "Gemini REST / SDK", apiKeyStatus: "missing", enabled: false },
    { id: "deepseek", name: "DeepSeek", envKey: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com", baseUrlEnv: "DEEPSEEK_API_BASE_URL", modelEnv: "DEEPSEEK_MODEL", defaultModel: "deepseek-chat", cliId: "deepseek", requestStyle: "OpenAI-compatible chat completions", apiKeyStatus: "missing", enabled: false },
    { id: "qwen", name: "Qwen", envKey: "QWEN_API_KEY", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", baseUrlEnv: "QWEN_API_BASE_URL", modelEnv: "QWEN_MODEL", defaultModel: "qwen-plus", cliId: "qwen", requestStyle: "OpenAI-compatible DashScope", apiKeyStatus: "missing", enabled: false },
    { id: "codex", name: "OpenAI / Codex", envKey: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1", baseUrlEnv: "OPENAI_API_BASE_URL", modelEnv: "CODEX_MODEL", defaultModel: "codex-cli", cliId: "codex", requestStyle: "Codex CLI / OpenAI API compatible", apiKeyStatus: "missing", enabled: false }
  ]
};

const defaultCliAgentConfig: CliAgentConfigResponse = {
  localBridgeEnabled: false,
  selectedCliId: "custom",
  tools: [
    { id: "claude", name: "Claude Code", command: "claude", commandEnv: "CLAUDE_CLI_COMMAND", argsEnv: "CLAUDE_CLI_ARGS", argsPreview: "-p {prompt}", providerHint: "Anthropic / Claude", installed: false, enabled: false },
    { id: "codex", name: "Codex CLI", command: "codex", commandEnv: "CODEX_CLI_COMMAND", argsEnv: "CODEX_CLI_ARGS", argsPreview: "exec {prompt}", providerHint: "OpenAI / Codex", installed: false, enabled: false },
    { id: "gemini", name: "Gemini CLI", command: "gemini", commandEnv: "GEMINI_CLI_COMMAND", argsEnv: "GEMINI_CLI_ARGS", argsPreview: "-p {prompt}", providerHint: "Google / Gemini", installed: false, enabled: false },
    { id: "qwen", name: "Qwen Code", command: "qwen", commandEnv: "QWEN_CLI_COMMAND", argsEnv: "QWEN_CLI_ARGS", argsPreview: "-p {prompt}", providerHint: "Alibaba / Qwen", installed: false, enabled: false },
    { id: "deepseek", name: "DeepSeek TUI", command: "deepseek", commandEnv: "DEEPSEEK_CLI_COMMAND", argsEnv: "DEEPSEEK_CLI_ARGS", argsPreview: "{prompt}", providerHint: "DeepSeek", installed: false, enabled: false },
    { id: "opencode", name: "OpenCode", command: "opencode", commandEnv: "OPENCODE_CLI_COMMAND", argsEnv: "OPENCODE_CLI_ARGS", argsPreview: "run {prompt}", providerHint: "OpenCode / OpenAI-compatible", installed: false, enabled: false }
  ]
};

const defaultLocalAgentRuntimeConfig: LocalAgentRuntimeConfig = {
  provider: "ollama",
  providerLabel: "Ollama local runtime",
  enabled: false,
  readyForUse: false,
  baseUrl: "http://localhost:11434",
  baseUrlEnv: "OLLAMA_BASE_URL",
  baseUrlStatus: "default",
  defaultModel: "qwen3:4b",
  executionMode: "settings-only",
  roles: [
    { id: "planner", label: "Planner Agent", envKey: "LOCAL_PLANNER_MODEL", model: "qwen3:4b", description: "วางแผน workflow / แตก task", enabled: true },
    { id: "chat", label: "Sprite Chat", envKey: "LOCAL_CHAT_MODEL", model: "gemma3:1b", description: "บทสนทนาเบา ๆ ของ sprite", enabled: true },
    { id: "coder", label: "Coder Agent", envKey: "LOCAL_CODER_MODEL", model: "qwen2.5-coder:3b", description: "ช่วยแก้ code / scene config", enabled: true },
    { id: "critic", label: "Critic Agent", envKey: "LOCAL_CRITIC_MODEL", model: "deepseek-r1:1.5b", description: "ตรวจแผนและหา risk", enabled: true }
  ]
};

const initialMemoryContextPanel: FloatingPanelFrame = settingConfig.defaults.panels.memoryContext;
const initialWorkflowMapPanel: FloatingPanelFrame = settingConfig.defaults.panels.workflowMap;
const initialProgressPanel: FloatingPanelFrame = settingConfig.defaults.panels.progress;
const initialTopHudPanel: FloatingPanelFrame = settingConfig.defaults.panels.topHud;
const initialSceneButtonFrames: Record<SceneButtonKey, SceneButtonFrame> = settingConfig.defaults.sceneButtonFrames;

const deskObjectPresets = [
  { id: "manager", label: "Manager Desk", src: "/objects/desks/manager_desk_transparent.png", color: "#ffce5c", width: 30, height: 15 },
  { id: "developer", label: "Developer Desk", src: "/objects/desks/developer_desk_transparent.png", color: "#42d9ff", width: 26, height: 14 },
  { id: "qa", label: "QA Desk", src: "/objects/desks/qa_desk_transparent.png", color: "#60ffa8", width: 24, height: 13 },
  { id: "analyst", label: "Analyst Desk", src: "/objects/desks/analyst_desk_transparent.png", color: "#ff7aa8", width: 26, height: 14 }
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/\.zip$/i, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pet"
  );
}

function loadImageSize(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("อ่านขนาดรูป spritesheet ไม่ได้"));
    image.src = url;
  });
}

function getModeLabel(mode: AgentMode) {
  if (mode === "workflow") return "วิ่งตาม workflow";
  if (mode === "wander") return "เดินเอง";
  return "ล็อก/ลากวาง";
}

function getAgentStatus(mode: AgentMode) {
  if (mode === "workflow") return "เชื่อมกับ workflow node";
  if (mode === "wander") return "เดินเองอิสระและรอรับงาน";
  return "ล็อกตำแหน่งจากการลากวาง";
}

function getThoughtForRole(role: AgentRuntimeRole, seed = Date.now()) {
  const pool = agentThoughtPools[role] ?? agentThoughtPools.chat;
  return pool[Math.abs(seed) % pool.length] ?? "กำลังคิดใน scene";
}

function buildCasualAgentReply(agent: AgentSprite, body: string) {
  const template = casualReplyTemplates[Math.abs(body.length + agent.name.length) % casualReplyTemplates.length];
  const shortBody = body.length > 54 ? `${body.slice(0, 54)}...` : body;
  return `${template} — ${agentRuntimeRoleLabels[agent.runtimeRole]}: ${shortBody}`;
}

function normalizeAgentSprite(agent: AgentSprite, index: number): AgentSprite {
  const runtimeRole = agent.runtimeRole ?? (index === 0 ? "planner" : "chat");
  return {
    ...agent,
    runtimeRole,
    autonomy: agent.autonomy ?? true,
    thought: agent.thought ?? agent.status ?? getThoughtForRole(runtimeRole, index),
    bubbleTone: agent.bubbleTone ?? (agent.mode === "workflow" ? "workflow" : "idle")
  };
}

function timeLabel() {
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function insertAt<T>(items: T[], index: number, item: T) {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function Home() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(initialWorkflowSteps);
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>(initialSceneObjects);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(initialWorkflowSteps[0].id);
  const [selectedObjectId, setSelectedObjectId] = useState(initialSceneObjects[0].id);
  const [sceneMode, setSceneMode] = useState<SceneMode>("play");
  const [isRunning, setIsRunning] = useState(true);
  const [activeMenu, setActiveMenu] = useState<MenuTab>("chat");
  const [consoleMode, setConsoleMode] = useState<ConsoleMode>("agent");
  const [prompt, setPrompt] = useState("สร้างรายงานยอดขายรายสัปดาห์ พร้อมค้นหาข่าวคู่แข่งและตรวจตัวเลขก่อนสรุป");
  const [petAssets, setPetAssets] = useState<PetAsset[]>(builtInPets);
  const [backgrounds, setBackgrounds] = useState<SceneBackground[]>(initialBackgrounds);
  const [activeBackgroundId, setActiveBackgroundId] = useState(initialBackgrounds[1].id);
  const [backgroundFit, setBackgroundFit] = useState<BackgroundFit>("contain");
  const [backgroundZoom, setBackgroundZoom] = useState(1);
  const [workflowDockFrame, setWorkflowDockFrame] = useState<WorkflowDockFrame>(settingConfig.defaults.workflowDockFrame);
  const [isWorkflowDockVisible, setIsWorkflowDockVisible] = useState(true);
  const [isWorkflowDockCollapsed, setIsWorkflowDockCollapsed] = useState(false);
  const [memoryContextPanel, setMemoryContextPanel] = useState<FloatingPanelFrame>(initialMemoryContextPanel);
  const [workflowMapPanel, setWorkflowMapPanel] = useState<FloatingPanelFrame>(initialWorkflowMapPanel);
  const [progressPanel, setProgressPanel] = useState<FloatingPanelFrame>(initialProgressPanel);
  const [topHudPanel, setTopHudPanel] = useState<FloatingPanelFrame>(initialTopHudPanel);
  const [sceneButtonFrames, setSceneButtonFrames] = useState<Record<SceneButtonKey, SceneButtonFrame>>(initialSceneButtonFrames);
  const [hasLoadedSavedScene, setHasLoadedSavedScene] = useState(false);
  const [importStatus, setImportStatus] = useState("พร้อม import sprite เพิ่ม");
  const [backgroundImportStatus, setBackgroundImportStatus] = useState("เลือก background ได้จาก library หรืออัปโหลดรูปใหม่");
  const [draggingAgentId, setDraggingAgentId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("agent-planner-lumina");
  const [modelConfig, setModelConfig] = useState<ModelConfigResponse>(defaultModelConfig);
  const [selectedModelProviderId, setSelectedModelProviderId] = useState<ModelProviderConfig["id"]>(defaultModelConfig.selectedProviderId);
  const [cliAgentConfig, setCliAgentConfig] = useState<CliAgentConfigResponse>(defaultCliAgentConfig);
  const [selectedCliId, setSelectedCliId] = useState(defaultCliAgentConfig.selectedCliId);
  const [localAgentRuntimeConfig, setLocalAgentRuntimeConfig] = useState<LocalAgentRuntimeConfig>(defaultLocalAgentRuntimeConfig);
  const [selectedLocalRoleId, setSelectedLocalRoleId] = useState<LocalAgentRoleConfig["id"]>("planner");
  const [cliRunStatus, setCliRunStatus] = useState("เลือก CLI engine แล้วส่ง prompt แบบ OpenDesign-style");
  const [cliRunOutput, setCliRunOutput] = useState<CliRunResponse | null>(null);
  const [isCliRunning, setIsCliRunning] = useState(false);
  const [isModelConfigDialogOpen, setIsModelConfigDialogOpen] = useState(false);
  const [modelConfigDialogTab, setModelConfigDialogTab] = useState<ModelConfigDialogTab>("api");
  const [configDialogStatus, setConfigDialogStatus] = useState("เลือก API provider แล้วระบบจะจับคู่ CLI ที่ตรงกันให้อัตโนมัติ");
  const [chatMessages, setChatMessages] = useState<PixelChatMessage[]>([
    {
      id: "system-welcome",
      from: "system",
      author: "SYSTEM",
      body: "Pixel chat พร้อมใช้งาน คลิก sprite ในฉากเพื่อคุยกับ agent ตัวนั้น หรือใช้ free-style prompt ส่งคำสั่งตรงจาก scene ได้เลย",
      time: "live"
    }
  ]);
  const [agents, setAgents] = useState<AgentSprite[]>(() => [
    createAgentSprite({
      id: "agent-planner-lumina",
      name: "Lumina",
      role: "Planner Agent",
      petId: "lumina",
      mode: "workflow",
      x: initialWorkflowSteps[0].x,
      y: initialWorkflowSteps[0].y,
      stepOffset: 0,
      color: agentColors[0],
      speed: 18,
      runtimeRole: "planner",
      thought: "กำลังวางแผน workflow แรก"
    }),
    createAgentSprite({
      id: "agent-research-keqing",
      name: "Keqing",
      role: "Research Agent",
      petId: "keqing",
      mode: "wander",
      x: 67,
      y: 72,
      stepOffset: 3,
      color: agentColors[1],
      speed: 12,
      runtimeRole: "chat",
      thought: "พร้อมคุยเล่นและเดินสำรวจ"
    })
  ]);

  useEffect(() => {
    try {
      const rawSavedLayout = window.localStorage.getItem(SCENE_STORAGE_KEY);
      if (!rawSavedLayout) {
        setHasLoadedSavedScene(true);
        return;
      }

      const savedLayout = JSON.parse(rawSavedLayout) as SavedSceneLayout;
      if (Array.isArray(savedLayout.workflowSteps) && savedLayout.workflowSteps.length > 0) {
        setWorkflowSteps(savedLayout.workflowSteps);
        setSelectedWorkflowId(savedLayout.workflowSteps[0].id);
      }
      if (Array.isArray(savedLayout.sceneObjects)) {
        setSceneObjects(savedLayout.sceneObjects.map((object) => ({ ...object, rotation: object.rotation ?? 0 })));
        setSelectedObjectId("");
      }
      if (Array.isArray(savedLayout.agents) && savedLayout.agents.length > 0) {
        setAgents(savedLayout.agents.map((agent, index) => normalizeAgentSprite(agent, index)));
        setSelectedAgentId(savedLayout.agents[0]?.id ?? "agent-planner-lumina");
      }
      if (savedLayout.workflowDockFrame) setWorkflowDockFrame(savedLayout.workflowDockFrame);
      if (typeof savedLayout.isWorkflowDockVisible === "boolean") setIsWorkflowDockVisible(savedLayout.isWorkflowDockVisible);
      if (typeof savedLayout.isWorkflowDockCollapsed === "boolean") setIsWorkflowDockCollapsed(savedLayout.isWorkflowDockCollapsed);
      if (savedLayout.memoryContextPanel) setMemoryContextPanel({ ...initialMemoryContextPanel, ...savedLayout.memoryContextPanel });
      if (savedLayout.workflowMapPanel) setWorkflowMapPanel({ ...initialWorkflowMapPanel, ...savedLayout.workflowMapPanel });
      if (savedLayout.progressPanel) setProgressPanel({ ...initialProgressPanel, ...savedLayout.progressPanel });
      if (savedLayout.topHudPanel) setTopHudPanel({ ...initialTopHudPanel, ...savedLayout.topHudPanel });
      if (savedLayout.sceneButtonFrames) setSceneButtonFrames({ ...initialSceneButtonFrames, ...savedLayout.sceneButtonFrames });
      if (savedLayout.activeBackgroundId && initialBackgrounds.some((background) => background.id === savedLayout.activeBackgroundId)) {
        setActiveBackgroundId(savedLayout.activeBackgroundId);
      }
      if (savedLayout.backgroundFit) setBackgroundFit(savedLayout.backgroundFit);
      if (typeof savedLayout.backgroundZoom === "number") setBackgroundZoom(clampPosition(savedLayout.backgroundZoom, 0.6, 1.4));
    } catch (error) {
      console.warn("Could not load saved scene layout", error);
    } finally {
      setHasLoadedSavedScene(true);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadModelConfig() {
      try {
        const response = await fetch("/api/model-config");
        if (!response.ok) throw new Error("model config api failed");
        const data = (await response.json()) as ModelConfigResponse;
        if (!ignore) {
          setModelConfig(data);
          setSelectedModelProviderId(data.selectedProviderId);
        }
      } catch (error) {
        console.warn("Could not load model config", error);
      }
    }

    async function loadCliAgentConfig() {
      try {
        const response = await fetch("/api/cli-agents");
        if (!response.ok) throw new Error("cli agents api failed");
        const data = (await response.json()) as CliAgentConfigResponse;
        if (!ignore) {
          setCliAgentConfig(data);
          setSelectedCliId(data.selectedCliId);
        }
      } catch (error) {
        console.warn("Could not load CLI agent config", error);
      }
    }

    async function loadLocalAgentRuntime() {
      try {
        const response = await fetch("/api/local-agent-config");
        if (!response.ok) throw new Error("local agent config api failed");
        const data = (await response.json()) as LocalAgentRuntimeConfig;
        if (!ignore) {
          setLocalAgentRuntimeConfig(data);
          setSelectedLocalRoleId(data.roles[0]?.id ?? "planner");
        }
      } catch (error) {
        console.warn("Could not load local agent runtime config", error);
      }
    }

    loadModelConfig();
    loadCliAgentConfig();
    loadLocalAgentRuntime();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedScene) return;

    const savedLayout: SavedSceneLayout = {
      workflowSteps,
      sceneObjects,
      agents,
      workflowDockFrame,
      isWorkflowDockVisible,
      isWorkflowDockCollapsed,
      memoryContextPanel,
      workflowMapPanel,
      progressPanel,
      topHudPanel,
      sceneButtonFrames,
      activeBackgroundId: initialBackgrounds.some((background) => background.id === activeBackgroundId) ? activeBackgroundId : initialBackgrounds[1].id,
      backgroundFit,
      backgroundZoom
    };

    try {
      window.localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(savedLayout));
    } catch (error) {
      console.warn("Could not save scene layout", error);
    }
  }, [hasLoadedSavedScene, workflowSteps, sceneObjects, agents, workflowDockFrame, isWorkflowDockVisible, isWorkflowDockCollapsed, memoryContextPanel, workflowMapPanel, progressPanel, topHudPanel, sceneButtonFrames, activeBackgroundId, backgroundFit, backgroundZoom]);

  useEffect(() => {
    if (!isRunning || workflowSteps.length === 0) return;
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % workflowSteps.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [isRunning, workflowSteps.length]);

  useEffect(() => {
    if (workflowSteps.length === 0) return;
    setActiveStep((current) => clampPosition(current, 0, workflowSteps.length - 1));
  }, [workflowSteps.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAgents((currentAgents) =>
        currentAgents.map((agent) => {
          if (agent.id === draggingAgentId) return agent;

          if (agent.mode === "manual") {
            return agent.isMoving || agent.status !== getAgentStatus("manual")
              ? { ...agent, isMoving: false, status: getAgentStatus("manual"), targetX: agent.x, targetY: agent.y }
              : agent;
          }

          let targetX = agent.targetX;
          let targetY = agent.targetY;
          let status = agent.status;
          let thought = agent.thought;
          let bubbleTone = agent.bubbleTone;

          if (agent.mode === "workflow" && workflowSteps.length > 0) {
            const step = workflowSteps[(activeStep + agent.stepOffset) % workflowSteps.length];
            targetX = step.x;
            targetY = step.y;
            status = `${step.label}: ${step.status}`;
            thought = `Workflow: ${step.label} · ${step.status}`;
            bubbleTone = "workflow";
          }

          const distanceToTarget = Math.hypot(targetX - agent.x, targetY - agent.y);

          if (agent.mode === "wander" && distanceToTarget < 1.1) {
            const nextPoint = randomStagePoint();
            targetX = nextPoint.x;
            targetY = nextPoint.y;
            status = agent.status.startsWith("Chat:") ? agent.status : getAgentStatus("wander");
            thought = agent.thought || getThoughtForRole(agent.runtimeRole);
            bubbleTone = agent.bubbleTone === "chat" ? "chat" : "idle";
          }

          const dx = targetX - agent.x;
          const dy = targetY - agent.y;
          const distance = Math.hypot(dx, dy);

          if (distance < 0.18) {
            return {
              ...agent,
              targetX,
              targetY,
              status,
              thought,
              bubbleTone,
              isMoving: false
            };
          }

          const tickSeconds = 0.12;
          const stepSize = agent.speed * tickSeconds;
          const ratio = Math.min(1, stepSize / distance);
          const nextX = agent.x + dx * ratio;
          const nextY = agent.y + dy * ratio;

          return {
            ...agent,
            x: nextX,
            y: nextY,
            targetX,
            targetY,
            status,
            thought,
            bubbleTone,
            direction: dx >= 0 ? "right" : "left",
            isMoving: distance > 0.35
          };
        })
      );
    }, 120);

    return () => window.clearInterval(timer);
  }, [activeStep, draggingAgentId, workflowSteps]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAgents((currentAgents) =>
        currentAgents.map((agent, index) => {
          if (!agent.autonomy || agent.id === draggingAgentId || agent.mode === "manual") return agent;

          const role = agent.runtimeRole ?? "chat";
          const thought = getThoughtForRole(role, Date.now() + index + agent.id.length);

          if (agent.mode === "workflow") {
            return {
              ...agent,
              thought,
              bubbleTone: "workflow"
            };
          }

          const point = randomStagePoint();
          return {
            ...agent,
            mode: "wander",
            targetX: point.x,
            targetY: point.y,
            status: thought,
            thought,
            bubbleTone: "thinking",
            direction: point.x >= agent.x ? "right" : "left",
            isMoving: true
          };
        })
      );
    }, 5200);

    return () => window.clearInterval(timer);
  }, [draggingAgentId]);

  const current = workflowSteps[activeStep] ?? workflowSteps[0];
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  const selectedWorkflow = workflowSteps.find((step) => step.id === selectedWorkflowId) ?? current;
  const selectedObject = sceneObjects.find((object) => object.id === selectedObjectId) ?? null;
  const activeBackground = backgrounds.find((background) => background.id === activeBackgroundId) ?? backgrounds[0];
  const backgroundSize = backgroundFit === "stretch" ? "100% 100%" : backgroundFit;
  const backgroundObjectFit = backgroundFit === "stretch" ? "fill" : backgroundFit === "cover" ? "cover" : "contain";
  const sceneBackgroundStyle = {
    backgroundColor: "#08111c",
    "--layer-background": settingConfig.sceneLayers.background,
    "--layer-ambient": settingConfig.sceneLayers.ambient,
    "--layer-workflow-edges": settingConfig.sceneLayers.workflowEdges,
    "--layer-sprites": settingConfig.sceneLayers.sprites,
    "--layer-workflow-markers": settingConfig.sceneLayers.workflowMarkers,
    "--layer-workflow-controls": settingConfig.sceneLayers.workflowControls,
    "--layer-objects": settingConfig.sceneLayers.objects,
    "--layer-hud": settingConfig.sceneLayers.hud,
    "--layer-floating-panels": settingConfig.sceneLayers.floatingPanels
  } as CSSProperties;
  const promptDockStyle = {
    left: `${workflowDockFrame.x}%`,
    top: `${workflowDockFrame.y}%`,
    bottom: "auto",
    width: `${workflowDockFrame.width}%`,
    height: isWorkflowDockCollapsed ? "auto" : `${workflowDockFrame.height}%`
  } as CSSProperties;
  const topHudStyle = {
    left: `${topHudPanel.x}%`,
    top: `${topHudPanel.y}%`,
    right: "auto",
    width: `${topHudPanel.width}%`,
    minHeight: topHudPanel.collapsed ? "auto" : `${topHudPanel.height}%`
  } as CSSProperties;
  const sceneActionButtons: Array<{ key: SceneButtonKey; icon: string; label: string; className?: string; onClick: () => void }> = [
    {
      key: "editScene",
      icon: sceneMode === "edit" ? "check" : "grid",
      label: sceneMode === "edit" ? "Done edit" : "Edit scene",
      className: sceneMode === "edit" ? "active" : "",
      onClick: () => { if (sceneMode === "edit") leaveSceneEditMode(); else setSceneMode("edit"); }
    },
    { key: "memory", icon: "database", label: "Memory", onClick: () => openFloatingPanel("memory") },
    { key: "workflow", icon: "line", label: "Workflow", onClick: () => openFloatingPanel("workflow") },
    { key: "progress", icon: "clock", label: "Progress", onClick: () => openFloatingPanel("progress") },
    { key: "freeRoam", icon: "sparkles", label: "Free roam", onClick: releaseAllAgents },
    { key: "runPause", icon: isRunning ? "pause" : "play", label: isRunning ? "Pause" : "Run", className: "primary", onClick: () => setIsRunning((value) => !value) }
  ];
  const fallbackModelProvider = modelConfig.providers[0] ?? defaultModelConfig.providers[0];
  const selectedModelProvider = modelConfig.providers.find((provider) => provider.id === selectedModelProviderId) ?? fallbackModelProvider;
  const matchedCliTool = cliAgentConfig.tools.find((tool) => tool.id === selectedModelProvider.cliId) ?? cliAgentConfig.tools.find((tool) => tool.id === selectedCliId) ?? cliAgentConfig.tools[0];
  const selectedCliTool = cliAgentConfig.tools.find((tool) => tool.id === selectedCliId) ?? matchedCliTool;
  const detectedCliCount = cliAgentConfig.tools.filter((tool) => tool.enabled).length;
  const apiCliPairRows = modelConfig.providers.map((provider) => ({
    provider,
    cliTool: cliAgentConfig.tools.find((tool) => tool.id === provider.cliId) ?? null
  }));
  const selectedApiCliPair = apiCliPairRows.find((row) => row.provider.id === selectedModelProvider.id) ?? apiCliPairRows[0];
  const selectedPairCliTool = selectedApiCliPair?.cliTool ?? selectedCliTool;
  const selectedEnvPreview = selectedModelProvider
    ? [
        `${selectedModelProvider.envKey}=`,
        `${selectedModelProvider.baseUrlEnv}=${selectedModelProvider.baseUrl ?? ""}`,
        `${selectedModelProvider.modelEnv}=${selectedModelProvider.defaultModel}`,
        `CLI_AGENT_DEFAULT=${selectedModelProvider.cliId}`,
        `${selectedPairCliTool?.commandEnv ?? "CUSTOM_AGENT_COMMAND"}=${selectedPairCliTool?.command ?? ""}`,
        `${selectedPairCliTool?.argsEnv ?? "CUSTOM_AGENT_ARGS"}=${selectedPairCliTool?.argsPreview ?? "{prompt}"}`
      ].join("\n")
    : "";
  const selectedLocalRole = localAgentRuntimeConfig.roles.find((role) => role.id === selectedLocalRoleId) ?? localAgentRuntimeConfig.roles[0];
  const enabledLocalRoleCount = localAgentRuntimeConfig.roles.filter((role) => role.enabled).length;
  const workflowProgress = workflowSteps.length > 0 ? Math.round(((activeStep + 1) / workflowSteps.length) * 100) : 0;

  const workflowEdges = useMemo(() => {
    return workflowSteps.slice(0, -1).map((step, index) => {
      const next = workflowSteps[index + 1];
      return { from: step, to: next, index, midX: (step.x + next.x) / 2, midY: (step.y + next.y) / 2 };
    });
  }, [workflowSteps]);

  const logs = useMemo<AgentLog[]>(() => {
    return [
      ...baseLogs,
      { time: "live", label: current?.title ?? "Workflow", detail: current?.status ?? "ยังไม่มี workflow step" },
      { time: "edit", label: "Scene mode", detail: sceneMode === "edit" ? "กำลังแก้ไข scene / workflow" : "โหมดเล่น live scene" },
      { time: "pets", label: "Sprite library", detail: `${petAssets.length} sprites, ${agents.length} active agents` },
      { time: "background", label: "Background", detail: `${activeBackground.name} (${activeBackground.source}) / fit: ${backgroundFit} / zoom: ${backgroundZoom.toFixed(2)}x` },
      { time: "config", label: "setting-config.json", detail: `schema v${settingConfig.schemaVersion} / workflow editor: ${settingConfig.workflowEditor.style} / object layer: ${settingConfig.sceneLayers.objects}` },
      { time: "workflow-frame", label: "Workflow frame", detail: `${isWorkflowDockVisible ? "visible" : "hidden"} / ${isWorkflowDockCollapsed ? "collapsed" : "expanded"} / x ${Math.round(workflowDockFrame.x)} / y ${Math.round(workflowDockFrame.y)} / w ${Math.round(workflowDockFrame.width)} / h ${Math.round(workflowDockFrame.height)}` },
      { time: "chat", label: "Messages", detail: `${chatMessages.length} pixel chat messages` }
    ];
  }, [current, sceneMode, petAssets.length, agents.length, chatMessages.length, activeBackground.name, activeBackground.source, backgroundFit, backgroundZoom, workflowDockFrame.x, workflowDockFrame.y, workflowDockFrame.width, workflowDockFrame.height, isWorkflowDockVisible, isWorkflowDockCollapsed]);

  const tokenUsageRows = useMemo<TokenUsageRow[]>(() => {
    return agents.map((agent, index) => {
      const provider = modelConfig.providers[index % Math.max(1, modelConfig.providers.length)] ?? selectedModelProvider;
      const agentMessages = chatMessages.filter((message) => message.agentId === agent.id);
      const promptTokens = 420 + agentMessages.reduce((sum, message) => sum + Math.max(8, Math.ceil(message.body.length / 3.8)), 0);
      const completionTokens = 180 + Math.max(0, agentMessages.filter((message) => message.from === "agent").length * 96);
      return {
        agentId: agent.id,
        agentName: agent.name,
        providerId: provider.id,
        providerName: provider.name,
        model: provider.defaultModel,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        lastRun: agentMessages.at(-1)?.time ?? "idle"
      };
    });
  }, [agents, chatMessages, modelConfig.providers, selectedModelProvider]);

  const totalTokenUsage = tokenUsageRows.reduce((sum, row) => sum + row.totalTokens, 0);

  function stagePointFromPointer(event: PointerEvent | globalThis.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return { x: 50, y: 50 };
    const bounds = stage.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100
    };
  }

  function updateAgent(agentId: string, updater: (agent: AgentSprite) => AgentSprite) {
    setAgents((currentAgents) => currentAgents.map((agent) => (agent.id === agentId ? updater(agent) : agent)));
  }

  function setAgentMode(agentId: string, mode: AgentMode) {
    updateAgent(agentId, (agent) => {
      const target = mode === "wander" ? randomStagePoint() : { x: agent.x, y: agent.y };
      const workflowTarget = mode === "workflow" && workflowSteps.length > 0 ? workflowSteps[(activeStep + agent.stepOffset) % workflowSteps.length] : null;

      return {
        ...agent,
        mode,
        targetX: workflowTarget?.x ?? target.x,
        targetY: workflowTarget?.y ?? target.y,
        status: getAgentStatus(mode),
        thought: mode === "workflow" ? "กำลังผูกกับ workflow node" : mode === "wander" ? getThoughtForRole(agent.runtimeRole) : "ล็อกไว้ที่ตำแหน่งนี้",
        bubbleTone: mode === "workflow" ? "workflow" : mode === "wander" ? "idle" : "idle",
        isMoving: mode !== "manual",
        direction: (workflowTarget?.x ?? target.x) >= agent.x ? "right" : "left"
      };
    });
  }

  function releaseAllAgents() {
    setAgents((currentAgents) =>
      currentAgents.map((agent) => {
        const point = randomStagePoint();
        return {
          ...agent,
          mode: "wander",
          targetX: point.x,
          targetY: point.y,
          status: getAgentStatus("wander"),
          thought: getThoughtForRole(agent.runtimeRole),
          bubbleTone: "thinking",
          isMoving: true,
          direction: point.x >= agent.x ? "right" : "left"
        };
      })
    );
  }

  function spawnAgent(pet: PetAsset) {
    const point = randomStagePoint();
    const newAgentId = `agent-${pet.id}-${Date.now().toString(36)}`;
    setAgents((currentAgents) => {
      const index = currentAgents.length;
      return [
        ...currentAgents,
        createAgentSprite({
          id: newAgentId,
          name: pet.displayName,
          role: `${pet.displayName} Agent`,
          petId: pet.id,
          mode: "wander",
          x: point.x,
          y: point.y,
          color: agentColors[index % agentColors.length],
          stepOffset: workflowSteps.length > 0 ? index % workflowSteps.length : 0,
          speed: 11 + (index % 4) * 2,
          runtimeRole: "chat",
          thought: "เกิดใหม่ใน scene พร้อมคุยเล่น"
        })
      ];
    });
    setSelectedAgentId(newAgentId);
    setActiveMenu("chat");
  }

  function sendMessageToSelectedAgent(body: string, origin: "chat" | "prompt" = "chat") {
    const cleanBody = body.trim();
    if (!cleanBody || !selectedAgent) return;

    const now = timeLabel();
    const targetPoint = randomStagePoint();
    const thinkingText = `${agentRuntimeRoleLabels[selectedAgent.runtimeRole]} กำลังคิดคำตอบ...`;
    const replyBody = buildCasualAgentReply(selectedAgent, cleanBody);
    const userMessage: PixelChatMessage = {
      id: `user-${Date.now().toString(36)}`,
      from: "user",
      agentId: selectedAgent.id,
      author: origin === "prompt" ? "Free-style prompt" : "You",
      body: cleanBody,
      time: now
    };

    setChatMessages((messages) => [...messages, userMessage]);
    setChatDraft("");
    setActiveMenu("chat");
    updateAgent(selectedAgent.id, (agent) => ({
      ...agent,
      mode: "wander",
      targetX: targetPoint.x,
      targetY: targetPoint.y,
      status: `Thinking: ${cleanBody.length > 38 ? `${cleanBody.slice(0, 38)}...` : cleanBody}`,
      thought: thinkingText,
      bubbleTone: "thinking",
      autonomy: true,
      direction: targetPoint.x >= agent.x ? "right" : "left",
      isMoving: true
    }));

    window.setTimeout(() => {
      const replyPoint = randomStagePoint();
      const agentMessage: PixelChatMessage = {
        id: `agent-${selectedAgent.id}-${Date.now().toString(36)}`,
        from: "agent",
        agentId: selectedAgent.id,
        author: selectedAgent.name,
        body: `${replyBody} · runtime ยังเป็น mock/local placeholder`,
        time: timeLabel()
      };

      setChatMessages((messages) => [...messages, agentMessage]);
      updateAgent(selectedAgent.id, (agent) => ({
        ...agent,
        mode: "wander",
        targetX: replyPoint.x,
        targetY: replyPoint.y,
        status: `Chat: ${cleanBody.length > 42 ? `${cleanBody.slice(0, 42)}...` : cleanBody}`,
        thought: replyBody,
        bubbleTone: "chat",
        autonomy: true,
        direction: replyPoint.x >= agent.x ? "right" : "left",
        isMoving: true
      }));
    }, 760);
  }

  function sendChatMessage() {
    sendMessageToSelectedAgent(chatDraft, "chat");
  }

  function startWorkflowFromPrompt() {
    if (workflowSteps.length === 0) return;
    setActiveStep(0);
    setSelectedWorkflowId(workflowSteps[0].id);
    setIsRunning(true);
    setAgents((items) =>
      items.map((agent, index) => {
        if (index === 0) {
          const step = workflowSteps[0];
          return {
            ...agent,
            mode: "workflow",
            targetX: step.x,
            targetY: step.y,
            status: `Workflow: ${prompt.slice(0, 42)}${prompt.length > 42 ? "..." : ""}`,
            thought: "เริ่ม workflow จาก prompt แล้ว",
            bubbleTone: "workflow",
            isMoving: true
          };
        }
        return agent;
      })
    );
  }

  async function runPromptWithSelectedCli() {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isCliRunning) return;

    setConsoleMode("model");
    setCliRunStatus(`กำลังส่ง prompt ไปที่ ${selectedCliTool?.name ?? "CLI engine"}...`);
    setCliRunOutput(null);
    setIsCliRunning(true);

    try {
      const response = await fetch("/api/cli-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliId: selectedCliId, prompt: cleanPrompt, agentName: selectedAgent?.name ?? "Agent" })
      });
      const data = (await response.json()) as CliRunResponse;
      setCliRunOutput(data);
      setCliRunStatus(data.ok ? `CLI completed: ${data.cliName ?? selectedCliTool?.name ?? selectedCliId}` : data.error ?? "CLI run failed");

      const now = timeLabel();
      setChatMessages((messages) => [
        ...messages,
        {
          id: `cli-user-${Date.now().toString(36)}`,
          from: "user",
          agentId: selectedAgent?.id,
          author: "OpenDesign CLI",
          body: cleanPrompt,
          time: now
        },
        {
          id: `cli-agent-${Date.now().toString(36)}`,
          from: "agent",
          agentId: selectedAgent?.id,
          author: data.cliName ?? selectedCliTool?.name ?? "Local CLI",
          body: data.ok
            ? (data.stdout?.trim().slice(0, 520) || "CLI run completed with no stdout")
            : `CLI bridge: ${data.error ?? "not available"}`,
          time: now
        }
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown CLI bridge error";
      setCliRunStatus(message);
      setCliRunOutput({ ok: false, error: message });
    } finally {
      setIsCliRunning(false);
    }
  }

  function syncProviderWithCli(providerId: ModelProviderConfig["id"]) {
    const provider = modelConfig.providers.find((item) => item.id === providerId) ?? selectedModelProvider;
    setSelectedModelProviderId(provider.id);
    if (provider.cliId) setSelectedCliId(provider.cliId);
    setConfigDialogStatus(`${provider.name} จับคู่กับ CLI: ${provider.cliId}`);
  }

  function openModelConfigDialog(providerId?: ModelProviderConfig["id"], tab: ModelConfigDialogTab = "api") {
    if (providerId) syncProviderWithCli(providerId);
    setModelConfigDialogTab(tab);
    setIsModelConfigDialogOpen(true);
  }

  async function copySelectedEnvPreview() {
    try {
      await navigator.clipboard.writeText(selectedEnvPreview);
      setConfigDialogStatus("copy .env template แล้ว");
    } catch (error) {
      setConfigDialogStatus("copy ไม่สำเร็จ แต่สามารถ copy จากกล่อง .env preview ได้เอง");
    }
  }

  function addWorkflowStep(afterIndex = activeStep) {
    const safeAfterIndex = clampPosition(afterIndex, 0, Math.max(0, workflowSteps.length - 1));
    const previous = workflowSteps[safeAfterIndex];
    const next = workflowSteps[safeAfterIndex + 1];
    const id = `step-${Date.now().toString(36)}`;
    const newStep: WorkflowStep = {
      id,
      title: "New Agent Step",
      label: "ขั้นใหม่",
      description: "อธิบายงานที่ agent ต้องทำในขั้นนี้",
      x: next ? (previous.x + next.x) / 2 : clampPosition((previous?.x ?? 48) + 10, 10, 88),
      y: next ? (previous.y + next.y) / 2 : clampPosition((previous?.y ?? 62) + 2, 46, 86),
      accent: workflowColors[workflowSteps.length % workflowColors.length],
      status: "รอ config workflow"
    };

    setWorkflowSteps((items) => insertAt(items, safeAfterIndex + 1, newStep));
    setActiveStep(safeAfterIndex + 1);
    setSelectedWorkflowId(id);
    setSceneMode("edit");
    setActiveMenu("workflow");
  }

  function removeWorkflowStep(stepId: string) {
    if (workflowSteps.length <= 1) return;
    const index = workflowSteps.findIndex((step) => step.id === stepId);
    const nextSteps = workflowSteps.filter((step) => step.id !== stepId);
    setWorkflowSteps(nextSteps);
    const nextIndex = clampPosition(index > 0 ? index - 1 : 0, 0, nextSteps.length - 1);
    setActiveStep(nextIndex);
    setSelectedWorkflowId(nextSteps[nextIndex].id);
  }

  function updateWorkflowStep(stepId: string, patch: Partial<WorkflowStep>) {
    setWorkflowSteps((items) => items.map((step) => (step.id === stepId ? { ...step, ...patch } : step)));
  }

  function reorderWorkflowStep(stepId: string, direction: -1 | 1) {
    const index = workflowSteps.findIndex((step) => step.id === stepId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= workflowSteps.length) return;
    setWorkflowSteps((items) => moveItem(items, index, nextIndex));
    setActiveStep(nextIndex);
  }

  function handleWorkflowPointerDown(event: PointerEvent<HTMLButtonElement>, stepId: string) {
    if (sceneMode !== "edit") return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedWorkflowId(stepId);
    setActiveMenu("workflow");

    const step = workflowSteps.find((item) => item.id === stepId);
    if (!step) return;

    const start = stagePointFromPointer(event);
    const offset = { x: step.x - start.x, y: step.y - start.y };
    let didMove = false;

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      didMove = true;
      const next = stagePointFromPointer(moveEvent);
      updateWorkflowStep(stepId, {
        x: clampPosition(next.x + offset.x, 8, 92),
        y: clampPosition(next.y + offset.y, 42, 88)
      });
    };

    const handlePointerUp = () => {
      if (!didMove) {
        const index = workflowSteps.findIndex((item) => item.id === stepId);
        if (index >= 0) setActiveStep(index);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function addSceneObject(type: SceneObject["type"] = "table") {
    const point = randomStagePoint();
    const color = type === "table" ? "#ffce5c" : type === "note" ? "#60ffa8" : type === "portal" ? "#9b8cff" : type === "desk" ? "#42d9ff" : "#42d9ff";
    const id = `object-${type}-${Date.now().toString(36)}`;
    const newObject: SceneObject = {
      id,
      type,
      label: type === "table" ? "New Table" : type === "note" ? "New Note" : type === "portal" ? "Portal" : type === "desk" ? "Desk" : "Terminal",
      x: point.x,
      y: point.y,
      width: type === "table" ? 16 : type === "desk" ? 26 : 10,
      height: type === "table" ? 7 : type === "desk" ? 14 : 8,
      color,
      imageSrc: type === "desk" ? "/objects/desks/developer_desk_transparent.png" : undefined,
      rotation: type === "note" ? -2 : 0
    };
    setSceneObjects((items) => [...items, newObject]);
    setSelectedObjectId(id);
    setSceneMode("edit");
    setActiveMenu("scene");
  }

  function addDeskObject(preset: (typeof deskObjectPresets)[number]) {
    const point = randomStagePoint();
    const id = `object-desk-${preset.id}-${Date.now().toString(36)}`;
    const newObject: SceneObject = {
      id,
      type: "desk",
      label: preset.label,
      x: point.x,
      y: point.y,
      width: preset.width,
      height: preset.height,
      color: preset.color,
      imageSrc: preset.src,
      rotation: 0
    };
    setSceneObjects((items) => [...items, newObject]);
    setSelectedObjectId(id);
    setSceneMode("edit");
    setActiveMenu("scene");
  }

  function updateSceneObject(objectId: string, patch: Partial<SceneObject>) {
    setSceneObjects((items) => items.map((object) => (object.id === objectId ? { ...object, ...patch } : object)));
  }

  function removeSceneObject(objectId: string) {
    setSceneObjects((items) => {
      const next = items.filter((object) => object.id !== objectId);
      setSelectedObjectId(next[0]?.id ?? "");
      return next;
    });
  }

  function leaveSceneEditMode() {
    setSceneMode("play");
    setSelectedObjectId("");
  }

  function resetSavedLayout() {
    try {
      window.localStorage.removeItem(SCENE_STORAGE_KEY);
    } catch (error) {
      console.warn("Could not clear saved scene layout", error);
    }

    setWorkflowSteps(initialWorkflowSteps);
    setSceneObjects(initialSceneObjects);
    setWorkflowDockFrame(settingConfig.defaults.workflowDockFrame);
    setIsWorkflowDockVisible(true);
    setIsWorkflowDockCollapsed(false);
    setMemoryContextPanel(initialMemoryContextPanel);
    setWorkflowMapPanel(initialWorkflowMapPanel);
    setProgressPanel(initialProgressPanel);
    setTopHudPanel(initialTopHudPanel);
    setSceneButtonFrames(initialSceneButtonFrames);
    setBackgroundFit("contain");
    setBackgroundZoom(1);
    setActiveBackgroundId(initialBackgrounds[1].id);
    setSelectedObjectId("");
    setSelectedWorkflowId(initialWorkflowSteps[0].id);
    setBackgroundImportStatus("ล้าง layout ที่บันทึกไว้และคืนค่าเริ่มต้นแล้ว");
  }

  function handleSceneObjectPointerDown(event: PointerEvent<HTMLButtonElement>, objectId: string) {
    if (sceneMode !== "edit") return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedObjectId(objectId);
    setActiveMenu("scene");

    const object = sceneObjects.find((item) => item.id === objectId);
    if (!object) return;
    const start = stagePointFromPointer(event);
    const offset = { x: object.x - start.x, y: object.y - start.y };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const next = stagePointFromPointer(moveEvent);
      updateSceneObject(objectId, {
        x: clampPosition(next.x + offset.x, 4, 96),
        y: clampPosition(next.y + offset.y, 36, 90)
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function updateWorkflowDockFrame(patch: Partial<WorkflowDockFrame>) {
    setWorkflowDockFrame((frame) => {
      const nextWidth = clampPosition(patch.width ?? frame.width, 28, 96);
      const nextHeight = clampPosition(patch.height ?? frame.height, 16, 72);
      return {
        x: clampPosition(patch.x ?? frame.x, 1, Math.max(1, 99 - nextWidth)),
        y: clampPosition(patch.y ?? frame.y, 5, Math.max(5, 98 - nextHeight)),
        width: nextWidth,
        height: nextHeight
      };
    });
  }

  function resetWorkflowDockFrame() {
    setWorkflowDockFrame(settingConfig.defaults.workflowDockFrame);
    setIsWorkflowDockVisible(true);
    setIsWorkflowDockCollapsed(false);
    setMemoryContextPanel(initialMemoryContextPanel);
    setWorkflowMapPanel(initialWorkflowMapPanel);
    setProgressPanel(initialProgressPanel);
  }

  function handleWorkflowDockPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSceneMode("edit");

    const start = stagePointFromPointer(event);
    const offset = { x: workflowDockFrame.x - start.x, y: workflowDockFrame.y - start.y };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const next = stagePointFromPointer(moveEvent);
      updateWorkflowDockFrame({
        x: next.x + offset.x,
        y: next.y + offset.y
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handleWorkflowDockResizePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSceneMode("edit");
    setIsWorkflowDockCollapsed(false);

    const start = stagePointFromPointer(event);
    const startFrame = { ...workflowDockFrame };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const next = stagePointFromPointer(moveEvent);
      updateWorkflowDockFrame({
        width: startFrame.width + (next.x - start.x),
        height: startFrame.height + (next.y - start.y)
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function updateFloatingPanel(kind: FloatingPanelKind, patch: Partial<FloatingPanelFrame>) {
    const updater = (frame: FloatingPanelFrame) => {
      const nextWidth = clampPosition(patch.width ?? frame.width, 18, 80);
      const nextHeight = clampPosition(patch.height ?? frame.height, 10, 70);
      return {
        ...frame,
        ...patch,
        width: nextWidth,
        height: nextHeight,
        x: clampPosition(patch.x ?? frame.x, 1, Math.max(1, 99 - nextWidth)),
        y: clampPosition(patch.y ?? frame.y, 3, Math.max(3, 98 - nextHeight))
      };
    };

    if (kind === "memory") setMemoryContextPanel(updater);
    if (kind === "workflow") setWorkflowMapPanel(updater);
    if (kind === "progress") setProgressPanel(updater);
  }

  function openFloatingPanel(kind: FloatingPanelKind) {
    updateFloatingPanel(kind, { visible: true, collapsed: false });
  }

  function handleFloatingPanelPointerDown(event: PointerEvent<HTMLButtonElement>, kind: FloatingPanelKind, frame: FloatingPanelFrame) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = stagePointFromPointer(event);
    const offset = { x: frame.x - start.x, y: frame.y - start.y };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const next = stagePointFromPointer(moveEvent);
      updateFloatingPanel(kind, { x: next.x + offset.x, y: next.y + offset.y });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handleFloatingPanelResizePointerDown(event: PointerEvent<HTMLButtonElement>, kind: FloatingPanelKind, frame: FloatingPanelFrame) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    updateFloatingPanel(kind, { collapsed: false });
    const start = stagePointFromPointer(event);
    const startFrame = { ...frame };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const next = stagePointFromPointer(moveEvent);
      updateFloatingPanel(kind, {
        width: startFrame.width + (next.x - start.x),
        height: startFrame.height + (next.y - start.y)
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function updateTopHudPanel(patch: Partial<FloatingPanelFrame>) {
    setTopHudPanel((frame) => {
      const nextWidth = clampPosition(patch.width ?? frame.width, 26, 98);
      const nextHeight = clampPosition(patch.height ?? frame.height, 10, 44);
      return {
        ...frame,
        ...patch,
        width: nextWidth,
        height: nextHeight,
        x: clampPosition(patch.x ?? frame.x, 0.5, Math.max(0.5, 99 - nextWidth)),
        y: clampPosition(patch.y ?? frame.y, 1, Math.max(1, 98 - nextHeight))
      };
    });
  }

  function handleTopHudPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = stagePointFromPointer(event);
    const offset = { x: topHudPanel.x - start.x, y: topHudPanel.y - start.y };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const next = stagePointFromPointer(moveEvent);
      updateTopHudPanel({ x: next.x + offset.x, y: next.y + offset.y });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handleTopHudResizePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = stagePointFromPointer(event);
    const startFrame = { ...topHudPanel };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const next = stagePointFromPointer(moveEvent);
      updateTopHudPanel({
        width: startFrame.width + (next.x - start.x),
        height: startFrame.height + (next.y - start.y)
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function updateSceneButtonFrame(key: SceneButtonKey, patch: Partial<SceneButtonFrame>) {
    setSceneButtonFrames((frames) => {
      const currentFrame = frames[key] ?? initialSceneButtonFrames[key];
      return {
        ...frames,
        [key]: {
          x: clampPosition(patch.x ?? currentFrame.x, 1, 96),
          y: clampPosition(patch.y ?? currentFrame.y, 2, 94)
        }
      };
    });
  }

  function handleSceneButtonPointerDown(event: PointerEvent<HTMLButtonElement>, key: SceneButtonKey) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const frame = sceneButtonFrames[key] ?? initialSceneButtonFrames[key];
    const start = stagePointFromPointer(event);
    const offset = { x: frame.x - start.x, y: frame.y - start.y };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const next = stagePointFromPointer(moveEvent);
      updateSceneButtonFrame(key, { x: next.x + offset.x, y: next.y + offset.y });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  async function handlePetImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus("กำลังอ่านไฟล์ zip...");
      const zip = await JSZip.loadAsync(file);
      const petJsonFile = zip.file(/(^|\/)pet\.json$/i)[0];

      if (!petJsonFile) {
        throw new Error("ไม่พบ pet.json ใน zip");
      }

      const petJson = JSON.parse(await petJsonFile.async("string")) as ImportedPetJson;
      const spritesheetPath = petJson.spritesheetPath ?? "spritesheet.webp";
      const exactSpriteFile = zip.file(spritesheetPath);
      const fallbackSpriteFile = zip.file(new RegExp(`${escapeRegExp(spritesheetPath)}$`, "i"))[0] ?? zip.file(/\.(webp|png)$/i)[0];
      const spriteFile = exactSpriteFile ?? fallbackSpriteFile;

      if (!spriteFile) {
        throw new Error("ไม่พบ spritesheet ใน zip");
      }

      const spriteBlob = await spriteFile.async("blob");
      const spriteUrl = URL.createObjectURL(spriteBlob);
      const imageSize = await loadImageSize(spriteUrl);
      const columns = petJson.columns ?? 8;
      const rows = petJson.rows ?? 9;
      const frameWidth = petJson.frameWidth ?? Math.floor(imageSize.width / columns);
      const frameHeight = petJson.frameHeight ?? Math.floor(imageSize.height / rows);
      const importedName = petJson.displayName ?? file.name.replace(/\.zip$/i, "");
      const importedId = `${slugify(petJson.id ?? importedName)}-${Date.now().toString(36)}`;

      const importedPet: PetAsset = {
        id: importedId,
        displayName: importedName,
        description: petJson.description ?? "Imported Codex Pet sprite",
        kind: petJson.kind ?? "person",
        spritesheetUrl: spriteUrl,
        source: "imported",
        frameWidth,
        frameHeight,
        columns,
        rows,
        animation: {
          ...DEFAULT_ANIMATION,
          ...petJson.animation
        }
      };

      setPetAssets((currentPets) => [...currentPets, importedPet]);
      spawnAgent(importedPet);
      setImportStatus(`import สำเร็จ: ${importedPet.displayName}`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "import ไม่สำเร็จ");
    } finally {
      event.target.value = "";
    }
  }


  function handleBackgroundImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setBackgroundImportStatus("ไฟล์ background ต้องเป็นรูปภาพ เช่น PNG, JPG หรือ WEBP");
      event.target.value = "";
      return;
    }

    const src = URL.createObjectURL(file);
    const id = `bg-${slugify(file.name)}-${Date.now().toString(36)}`;
    const name = file.name.replace(/\.(png|jpe?g|webp|gif|avif)$/i, "") || "Imported Background";
    const nextBackground: SceneBackground = { id, name, src, source: "imported" };

    setBackgrounds((items) => [...items, nextBackground]);
    setActiveBackgroundId(id);
    setBackgroundImportStatus(`เปลี่ยน background เป็น: ${name}`);
    event.target.value = "";
  }

  return (
    <main className="liveSceneApp">
      <section className="screenPane" aria-label="Full screen AI agent live scene">
        <div
          ref={stageRef}
          className={`sceneStage fullScreenStage ${sceneMode === "edit" ? "editing" : "playing"}`}
          style={sceneBackgroundStyle}
          role="img"
          aria-label={`${activeBackground.name} background with draggable AI agent sprites`}
        >
          <div className="sceneBackdrop" aria-hidden="true">
            <img
              src={activeBackground.src}
              alt=""
              style={{ objectFit: backgroundObjectFit, transform: `scale(${backgroundZoom})` } as CSSProperties}
            />
          </div>

          <div className="ambientGrid" />

          <svg className="workflowEdgesSvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="lineGlow">
                <feGaussianBlur stdDeviation="0.55" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {workflowEdges.map((edge) => (
              <line
                key={`${edge.from.id}-${edge.to.id}`}
                className={`workflowEdgeLine ${edge.index === activeStep ? "active" : ""}`}
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
              />
            ))}
          </svg>

          {sceneMode === "edit" && workflowEdges.map((edge) => (
            <button
              key={`add-${edge.from.id}-${edge.to.id}`}
              className="edgeAddButton"
              style={{ left: `${edge.midX}%`, top: `${edge.midY}%` } as CSSProperties}
              type="button"
              onClick={() => addWorkflowStep(edge.index)}
              aria-label="Add workflow step between nodes"
              title="เพิ่ม workflow step ระหว่าง node นี้"
            >
              <PixelIcon name="plus" />
            </button>
          ))}

          {topHudPanel.visible ? (
            <header className="sceneHud topHud" style={topHudStyle}>
              <div className="topHudInfo">
                <button type="button" className="topHudHandle" onPointerDown={handleTopHudPointerDown} title="ลากเพื่อย้าย topbar">
                  <PixelIcon name="drag-horiozontal" />
                  Live scene / 80% / {sceneMode === "edit" ? "Edit mode" : "Play mode"}
                </button>
                <h1>{current?.title ?? "Workflow"}</h1>
                <span>{current?.description ?? "เพิ่ม workflow step เพื่อเริ่มออกแบบ agent flow"}</span>
              </div>
              <div className="topHudTools">
                <button type="button" className="controlButton ghost" onClick={() => updateTopHudPanel({ visible: false })}>
                  <PixelIcon name="eyes" />
                  Hide topbar
                </button>
                <button type="button" className="topHudResizeHandle" onPointerDown={handleTopHudResizePointerDown} aria-label="Resize topbar" title="ลากเพื่อย่อ/ขยาย topbar">
                  <PixelIcon name="crop" />
                </button>
              </div>
            </header>
          ) : (
            <div
              className="sceneActionButtonWrap topbarToggleWrap"
              style={{ left: `${sceneButtonFrames.topbarToggle.x}%`, top: `${sceneButtonFrames.topbarToggle.y}%` } as CSSProperties}
            >
              <button
                type="button"
                className="sceneActionDragHandle"
                onPointerDown={(event) => handleSceneButtonPointerDown(event, "topbarToggle")}
                aria-label="Move show topbar button"
                title="ลากปุ่ม Show topbar"
              >
                <PixelIcon name="drag-horiozontal" />
              </button>
              <button type="button" className="sceneHud sceneActionButton" onClick={() => updateTopHudPanel({ visible: true })}>
                <PixelIcon name="chevron-down" />
                Show topbar
              </button>
            </div>
          )}

          {sceneActionButtons.map((action) => (
            <div
              key={action.key}
              className="sceneActionButtonWrap"
              style={{ left: `${sceneButtonFrames[action.key].x}%`, top: `${sceneButtonFrames[action.key].y}%` } as CSSProperties}
            >
              <button
                type="button"
                className="sceneActionDragHandle"
                onPointerDown={(event) => handleSceneButtonPointerDown(event, action.key)}
                aria-label={`Move ${action.label} button`}
                title={`ลากปุ่ม ${action.label}`}
              >
                <PixelIcon name="drag-horiozontal" />
              </button>
              <button
                className={`sceneHud sceneActionButton ${action.className ?? ""}`}
                type="button"
                onClick={action.onClick}
              >
                <PixelIcon name={action.icon} />
                {action.label}
              </button>
            </div>
          ))}

          {!isWorkflowDockVisible && (
            <div
              className="sceneActionButtonWrap workflowToggleWrap"
              style={{ left: `${sceneButtonFrames.workflowToggle.x}%`, top: `${sceneButtonFrames.workflowToggle.y}%` } as CSSProperties}
            >
              <button
                type="button"
                className="sceneActionDragHandle"
                onPointerDown={(event) => handleSceneButtonPointerDown(event, "workflowToggle")}
                aria-label="Move open workflow button"
                title="ลากปุ่ม Open workflow"
              >
                <PixelIcon name="drag-horiozontal" />
              </button>
              <button
                type="button"
                className="sceneHud promptDockToggle"
                onClick={() => {
                  setIsWorkflowDockVisible(true);
                  setIsWorkflowDockCollapsed(false);
                }}
              >
                <PixelIcon name="chevron-up" />
                Open workflow
              </button>
            </div>
          )}

          {isWorkflowDockVisible && (
            <aside className={`sceneHud promptDock ${isWorkflowDockCollapsed ? "collapsed" : ""}`} style={promptDockStyle}>
              <div className="promptDockHeader">
                <button
                  type="button"
                  className="promptDockHandle"
                  onPointerDown={handleWorkflowDockPointerDown}
                  title="ลากเพื่อย้ายกรอบ workflow prompt แบบ freestyle"
                >
                  <PixelIcon name="drag-horiozontal" />
                  Move workflow frame
                </button>
                <div className="promptDockTools">
                  <button type="button" onClick={() => setIsWorkflowDockCollapsed((value) => !value)}>
                    <PixelIcon name={isWorkflowDockCollapsed ? "chevron-up" : "chevron-down"} />
                    {isWorkflowDockCollapsed ? "Expand" : "Collapse"}
                  </button>
                  <button type="button" onClick={() => setIsWorkflowDockVisible(false)}>
                    <PixelIcon name="eyes" />
                    Hide
                  </button>
                </div>
              </div>

              {!isWorkflowDockCollapsed && (
                <>
                  <label htmlFor="agentPrompt">Workflow / free-style prompt</label>
                  <textarea id="agentPrompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="พิมพ์ workflow prompt หรือ free-style task ให้ agent" />
                  <div className="promptActions">
                    <button type="button" className="primaryButton" onClick={startWorkflowFromPrompt}>
                      <PixelIcon name="play-circle" />
                      Start workflow
                    </button>
                    <button type="button" className="controlButton ghost" onClick={() => sendMessageToSelectedAgent(prompt, "prompt")} disabled={!prompt.trim() || !selectedAgent}>
                      <PixelIcon name="paperplane" />
                      Send free style
                    </button>
                    <button type="button" className="controlButton ghost" onClick={runPromptWithSelectedCli} disabled={!prompt.trim() || isCliRunning}>
                      <PixelIcon name="command" />
                      Run CLI
                    </button>
                  </div>
                  <button
                    type="button"
                    className="promptDockResizeHandle"
                    onPointerDown={handleWorkflowDockResizePointerDown}
                    aria-label="Resize workflow frame"
                    title="ลากเพื่อย่อ/ขยายกรอบ"
                  >
                    <PixelIcon name="crop" />
                  </button>
                </>
              )}
            </aside>
          )}

          {memoryContextPanel.visible && (
            <aside
              className={`sceneHud floatingScenePanel ${memoryContextPanel.collapsed ? "collapsed" : ""}`}
              style={{ left: `${memoryContextPanel.x}%`, top: `${memoryContextPanel.y}%`, width: `${memoryContextPanel.width}%`, height: memoryContextPanel.collapsed ? "auto" : `${memoryContextPanel.height}%` } as CSSProperties}
            >
              <div className="floatingPanelHeader">
                <button type="button" className="floatingPanelHandle" onPointerDown={(event) => handleFloatingPanelPointerDown(event, "memory", memoryContextPanel)}>
                  <PixelIcon name="drag-horiozontal" />
                  Memory + Context
                </button>
                <div className="floatingPanelTools">
                  <button type="button" onClick={() => updateFloatingPanel("memory", { collapsed: !memoryContextPanel.collapsed })}>{memoryContextPanel.collapsed ? "Open" : "Min"}</button>
                  <button type="button" onClick={() => updateFloatingPanel("memory", { visible: false })}>Hide</button>
                </div>
              </div>
              {!memoryContextPanel.collapsed && (
                <div className="floatingPanelBody memoryContextBody">
                  <p><strong>Selected agent</strong><span>{selectedAgent?.name ?? "No agent"} · {selectedAgent?.role ?? ""}</span></p>
                  <p><strong>Current step</strong><span>{current?.title ?? "Workflow"}</span></p>
                  <p><strong>Context count</strong><span>{workflowSteps.length} steps · {chatMessages.length} messages · {sceneObjects.length} objects</span></p>
                  <p><strong>Model route</strong><span>{selectedModelProvider?.name ?? "Model"} / {selectedModelProvider?.defaultModel ?? "default"}</span></p>
                  <button type="button" className="panelInlineButton" onClick={() => { setConsoleMode("agent"); setActiveMenu("chat"); }}>Open tab title</button>
                  <button type="button" className="floatingPanelResizeHandle" onPointerDown={(event) => handleFloatingPanelResizePointerDown(event, "memory", memoryContextPanel)} aria-label="Resize Memory + Context panel"><PixelIcon name="crop" /></button>
                </div>
              )}
            </aside>
          )}

          {workflowMapPanel.visible && (
            <aside
              className={`sceneHud floatingScenePanel workflowMapPanel ${workflowMapPanel.collapsed ? "collapsed" : ""}`}
              style={{ left: `${workflowMapPanel.x}%`, top: `${workflowMapPanel.y}%`, width: `${workflowMapPanel.width}%`, height: workflowMapPanel.collapsed ? "auto" : `${workflowMapPanel.height}%` } as CSSProperties}
            >
              <div className="floatingPanelHeader">
                <button type="button" className="floatingPanelHandle" onPointerDown={(event) => handleFloatingPanelPointerDown(event, "workflow", workflowMapPanel)}>
                  <PixelIcon name="line" />
                  Open Workflow
                </button>
                <div className="floatingPanelTools">
                  <button type="button" onClick={() => updateFloatingPanel("workflow", { collapsed: !workflowMapPanel.collapsed })}>{workflowMapPanel.collapsed ? "Open" : "Min"}</button>
                  <button type="button" onClick={() => updateFloatingPanel("workflow", { visible: false })}>Hide</button>
                </div>
              </div>
              {!workflowMapPanel.collapsed && (
                <div className="floatingPanelBody miniWorkflowList">
                  {workflowSteps.map((step, index) => (
                    <button key={step.id} type="button" className={index === activeStep ? "active" : ""} onClick={() => { setActiveStep(index); setSelectedWorkflowId(step.id); setIsRunning(false); }}>
                      <span>{index + 1}</span>
                      <strong>{step.label}</strong>
                      <em>{step.title}</em>
                    </button>
                  ))}
                  <button type="button" className="panelInlineButton" onClick={() => { setConsoleMode("agent"); setActiveMenu("workflow"); setSceneMode("edit"); }}>Edit workflow</button>
                  <button type="button" className="floatingPanelResizeHandle" onPointerDown={(event) => handleFloatingPanelResizePointerDown(event, "workflow", workflowMapPanel)} aria-label="Resize workflow map panel"><PixelIcon name="crop" /></button>
                </div>
              )}
            </aside>
          )}

          {progressPanel.visible && (
            <aside
              className={`sceneHud floatingScenePanel progressScenePanel ${progressPanel.collapsed ? "collapsed" : ""}`}
              style={{ left: `${progressPanel.x}%`, top: `${progressPanel.y}%`, width: `${progressPanel.width}%`, height: progressPanel.collapsed ? "auto" : `${progressPanel.height}%` } as CSSProperties}
            >
              <div className="floatingPanelHeader">
                <button type="button" className="floatingPanelHandle" onPointerDown={(event) => handleFloatingPanelPointerDown(event, "progress", progressPanel)}>
                  <PixelIcon name="clock" />
                  Progress Workflow
                </button>
                <div className="floatingPanelTools">
                  <button type="button" onClick={() => updateFloatingPanel("progress", { collapsed: !progressPanel.collapsed })}>{progressPanel.collapsed ? "Open" : "Min"}</button>
                  <button type="button" onClick={() => updateFloatingPanel("progress", { visible: false })}>Hide</button>
                </div>
              </div>
              {!progressPanel.collapsed && (
                <div className="floatingPanelBody progressPanelBody">
                  <div className="progressRingText"><strong>{workflowProgress}%</strong><span>{activeStep + 1}/{workflowSteps.length}</span></div>
                  <div className="workflowProgressBar"><span style={{ width: `${workflowProgress}%` }} /></div>
                  <p>{current?.label ?? "Workflow"}: {current?.status ?? "Idle"}</p>
                  <button type="button" className="panelInlineButton" onClick={() => { setIsRunning(true); openFloatingPanel("workflow"); }}>Run with workflow</button>
                  <button type="button" className="floatingPanelResizeHandle" onPointerDown={(event) => handleFloatingPanelResizePointerDown(event, "progress", progressPanel)} aria-label="Resize progress panel"><PixelIcon name="crop" /></button>
                </div>
              )}
            </aside>
          )}

          {sceneObjects.map((object) => (
            <button
              key={object.id}
              className={`sceneObject ${object.type} ${object.imageSrc ? "imageObject" : ""} ${sceneMode === "edit" && selectedObjectId === object.id ? "selected" : ""}`}
              style={{
                left: `${object.x}%`,
                top: `${object.y}%`,
                width: `${object.width}%`,
                height: `${object.height}%`,
                transform: `translate(-50%, -50%) rotate(${object.rotation ?? 0}deg)`,
                "--object-color": object.color
              } as CSSProperties}
              onPointerDown={(event) => handleSceneObjectPointerDown(event, object.id)}
              onClick={() => {
                if (sceneMode === "edit") {
                  setSelectedObjectId(object.id);
                  setActiveMenu("scene");
                }
              }}
              type="button"
              aria-label={`${object.label} scene object`}
              title={sceneMode === "edit" ? "ลากเพื่อย้าย object" : object.label}
            >
              {object.imageSrc ? (
                <>
                  <img className="sceneObjectImage" src={object.imageSrc} alt="" draggable={false} />
                  <span className="sceneObjectLabel">{object.label}</span>
                </>
              ) : (
                <span>{object.label}</span>
              )}
            </button>
          ))}

          {workflowSteps.map((step, index) => (
            <button
              key={step.id}
              className={`workflowMarker ${index === activeStep ? "active" : ""} ${selectedWorkflowId === step.id ? "selected" : ""}`}
              style={{ left: `${step.x}%`, top: `${step.y}%`, "--marker-color": step.accent } as CSSProperties}
              onPointerDown={(event) => handleWorkflowPointerDown(event, step.id)}
              onClick={() => {
                setSelectedWorkflowId(step.id);
                setActiveStep(index);
                setIsRunning(false);
                if (sceneMode === "edit") setActiveMenu("workflow");
              }}
              type="button"
              aria-label={`Go to ${step.title}`}
              title={sceneMode === "edit" ? "ลากเพื่อย้าย workflow node" : step.title}
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
            </button>
          ))}

          {agents.map((agent) => {
            const pet = petAssets.find((item) => item.id === agent.petId) ?? petAssets[0];
            return (
              <AgentPet
                key={agent.id}
                agent={agent}
                pet={pet}
                stageRef={stageRef}
                isActive={agent.mode === "workflow" || agent.id === selectedAgentId}
                onSelect={(agentId) => {
                  setSelectedAgentId(agentId);
                  setActiveMenu("chat");
                }}
                onDragStart={(agentId) => {
                  setDraggingAgentId(agentId);
                  setSelectedAgentId(agentId);
                  setActiveMenu("chat");
                  updateAgent(agentId, (item) => ({ ...item, mode: "manual", isMoving: false, status: "กำลังลาก sprite" }));
                }}
                onDragMove={(agentId, x, y) => {
                  updateAgent(agentId, (item) => ({
                    ...item,
                    x: clampPosition(x, 8, 92),
                    y: clampPosition(y, 44, 86),
                    targetX: clampPosition(x, 8, 92),
                    targetY: clampPosition(y, 44, 86),
                    direction: x >= item.x ? "right" : "left"
                  }));
                }}
                onDragEnd={(agentId) => {
                  setDraggingAgentId(null);
                  updateAgent(agentId, (item) => ({ ...item, status: getAgentStatus("manual"), isMoving: false }));
                }}
              />
            );
          })}
        </div>
      </section>

      <aside className="menuPane" aria-label="Agent menu panel">
        <div className="menuHeader">
          <div>
            <p className="miniLabel">Menu / 20%</p>
            <h2>{consoleMode === "agent" ? "Agent Console" : "Model Console"}</h2>
          </div>
          <span>{consoleMode === "agent" ? `${agents.length} sprites` : `${totalTokenUsage.toLocaleString()} tokens · ${detectedCliCount} CLI · ${enabledLocalRoleCount} local roles`}</span>
        </div>

        <div className="consoleModeSwitch" role="tablist" aria-label="Console mode">
          <button type="button" className={consoleMode === "agent" ? "active" : ""} onClick={() => setConsoleMode("agent")}>
            <PixelIcon name="sparkles" /> Agent Console
          </button>
          <button type="button" className={consoleMode === "model" ? "active" : ""} onClick={() => setConsoleMode("model")}>
            <PixelIcon name="database" /> Model Console
          </button>
        </div>

        {consoleMode === "agent" && (
          <nav className="menuTabs" aria-label="Console tabs">
            {(Object.keys(tabLabels) as MenuTab[]).map((tab) => (
              <button key={tab} type="button" className={activeMenu === tab ? "active" : ""} onClick={() => setActiveMenu(tab)}>
                <PixelIcon name={tabIcons[tab]} />
                {tabLabels[tab]}
              </button>
            ))}
          </nav>
        )}

        <div className="menuContent">
          {consoleMode === "model" && (
            <section className="glassPanel modelConsolePanel compactPanel">
              <p className="miniLabel"><PixelIcon name="database" /> Model Console</p>
              <div className="modelSummaryCard apiCliSummaryCard">
                <strong>{selectedModelProvider?.name ?? "Model provider"}</strong>
                <span>{selectedModelProvider?.defaultModel ?? "model"} · CLI: {selectedPairCliTool?.name ?? selectedModelProvider?.cliId ?? "not mapped"}</span>
                <em>{selectedModelProvider?.apiKeyStatus === "configured" ? "API key configured" : "waiting for .env"}</em>
                <button type="button" className="tinyButton" onClick={() => openModelConfigDialog(selectedModelProvider?.id, "api")}>
                  <PixelIcon name="wrench" /> Config dialog
                </button>
              </div>

              <div className="modelProviderGrid apiCliProviderGrid">
                {modelConfig.providers.map((provider) => {
                  const cliTool = cliAgentConfig.tools.find((tool) => tool.id === provider.cliId);
                  return (
                    <button key={provider.id} type="button" className={selectedModelProviderId === provider.id ? "selected" : ""} onClick={() => syncProviderWithCli(provider.id)}>
                      <strong>{provider.name}</strong>
                      <span>{provider.defaultModel}</span>
                      <small>CLI → {cliTool?.name ?? provider.cliId}</small>
                      <em className={provider.apiKeyStatus}>{provider.apiKeyStatus === "configured" ? "configured" : provider.envKey}</em>
                    </button>
                  );
                })}
              </div>

              <div className="apiCliPairPanel">
                <p className="miniLabel"><PixelIcon name="arrows-right-left" /> API model ↔ CLI pair</p>
                <div>
                  <strong>{selectedModelProvider?.name}</strong>
                  <span>{selectedModelProvider?.modelEnv} = {selectedModelProvider?.defaultModel}</span>
                </div>
                <div>
                  <strong>{selectedPairCliTool?.name ?? selectedModelProvider?.cliId}</strong>
                  <span>{selectedPairCliTool?.commandEnv} · {selectedPairCliTool?.argsEnv}</span>
                </div>
                <button type="button" className="controlButton ghost" onClick={() => openModelConfigDialog(selectedModelProvider?.id, "cli")}>
                  <PixelIcon name="command" /> Open detailed config
                </button>
              </div>

              <div className="tokenUsageList">
                {tokenUsageRows.map((row) => (
                  <div className="tokenUsageCard" key={row.agentId}>
                    <div>
                      <strong>{row.agentName}</strong>
                      <span>{row.providerName} · {row.model}</span>
                    </div>
                    <dl>
                      <div><dt>Prompt</dt><dd>{row.promptTokens.toLocaleString()}</dd></div>
                      <div><dt>Output</dt><dd>{row.completionTokens.toLocaleString()}</dd></div>
                      <div><dt>Total</dt><dd>{row.totalTokens.toLocaleString()}</dd></div>
                    </dl>
                    <em>last run: {row.lastRun}</em>
                  </div>
                ))}
              </div>

              <div className="codexCliBox localRuntimePanel">
                <p className="miniLabel"><PixelIcon name="home" /> Local agent runtime</p>
                <div className="localRuntimeHero">
                  <div>
                    <strong>{localAgentRuntimeConfig.providerLabel}</strong>
                    <span>{localAgentRuntimeConfig.baseUrl} · {selectedLocalRole?.label ?? "Local role"}: {selectedLocalRole?.model ?? localAgentRuntimeConfig.defaultModel}</span>
                    <em>{localAgentRuntimeConfig.enabled ? "env enabled" : "prepared only"} · not wired to chat yet</em>
                  </div>
                  <span className="settingsBadge">preview</span>
                </div>
                <div className="localRoleGrid">
                  {localAgentRuntimeConfig.roles.map((role) => (
                    <button key={role.id} type="button" className={selectedLocalRoleId === role.id ? "selected" : ""} onClick={() => setSelectedLocalRoleId(role.id)}>
                      <strong>{role.label}</strong>
                      <span>{role.model}</span>
                      <em>{role.description}</em>
                    </button>
                  ))}
                </div>
                <p className="helperText">ตั้งค่าไว้ล่วงหน้าสำหรับให้ sprite/agent คุยกันเองผ่าน local model ภายหลัง ตอนนี้ยังไม่เรียก Ollama จริง</p>
              </div>

              <div className="codexCliBox openDesignCliBox">
                <p className="miniLabel"><PixelIcon name="command" /> OpenDesign-style CLI Engines</p>
                <p>เลือก coding-agent CLI ที่ติดตั้งในเครื่อง แล้วให้ server bridge ส่ง prompt ไปหา CLI แบบ local-first / BYOK</p>
                <div className="cliToolGrid">
                  {cliAgentConfig.tools.map((tool) => (
                    <button key={tool.id} type="button" className={selectedCliId === tool.id ? "selected" : ""} onClick={() => setSelectedCliId(tool.id)}>
                      <strong>{tool.name}</strong>
                      <span>{tool.command || tool.commandEnv}</span>
                      <em className={tool.enabled ? "configured" : "missing"}>{tool.enabled ? "detected" : `set ${tool.commandEnv}`}</em>
                    </button>
                  ))}
                </div>
                <div className="cliBridgePanel">
                  <div>
                    <strong>{selectedCliTool?.name ?? "Local CLI"}</strong>
                    <span>{cliAgentConfig.localBridgeEnabled ? "bridge enabled" : "bridge locked"} · {selectedCliTool?.argsPreview ?? "{prompt}"}</span>
                  </div>
                  <button type="button" className="primaryButton" onClick={runPromptWithSelectedCli} disabled={!prompt.trim() || isCliRunning}>
                    <PixelIcon name="command" />
                    {isCliRunning ? "Running..." : "Run prompt via CLI"}
                  </button>
                </div>
                <p className="helperText">{cliRunStatus}</p>
                {cliRunOutput && (
                  <div className="cliRunOutput">
                    <strong>{cliRunOutput.ok ? "CLI output" : "CLI message"}</strong>
                    {cliRunOutput.commandLabel && <code>{cliRunOutput.commandLabel}</code>}
                    <pre>{(cliRunOutput.stdout || cliRunOutput.stderr || cliRunOutput.error || "No output").slice(0, 1800)}</pre>
                  </div>
                )}
              </div>
            </section>
          )}
          {consoleMode === "agent" && activeMenu === "chat" && (
            <PixelChat
              agents={agents}
              selectedAgentId={selectedAgent?.id ?? ""}
              onSelectedAgentChange={setSelectedAgentId}
              messages={chatMessages}
              draft={chatDraft}
              onDraftChange={setChatDraft}
              onSend={sendChatMessage}
            />
          )}

          {consoleMode === "agent" && activeMenu === "agents" && (
            <section className="glassPanel agentPanel compactPanel">
              <p className="miniLabel"><PixelIcon name="sparkles" /> Agent sprites</p>
              <div className="agentList">
                {agents.map((agent) => (
                  <div className="agentCard" key={agent.id} style={{ "--agent-color": agent.color } as CSSProperties}>
                    <div className="agentCardHeader">
                      <div>
                        <strong>{agent.name}</strong>
                        <span>{agent.role}</span>
                      </div>
                      <em>{getModeLabel(agent.mode)}</em>
                    </div>

                    <div className="agentControls">
                      <select
                        value={agent.mode}
                        onChange={(event) => setAgentMode(agent.id, event.target.value as AgentMode)}
                        aria-label={`Mode for ${agent.name}`}
                      >
                        <option value="workflow">วิ่งตาม workflow</option>
                        <option value="wander">เดินเอง / ปล่อยฟรี</option>
                        <option value="manual">ล็อกตำแหน่ง</option>
                      </select>
                      <select
                        value={agent.petId}
                        onChange={(event) => updateAgent(agent.id, (item) => ({ ...item, petId: event.target.value }))}
                        aria-label={`Pet asset for ${agent.name}`}
                      >
                        {petAssets.map((pet) => (
                          <option key={pet.id} value={pet.id}>
                            {pet.displayName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="agentRuntimeControls">
                      <label>
                        Runtime role
                        <select
                          value={agent.runtimeRole}
                          onChange={(event) =>
                            updateAgent(agent.id, (item) => ({
                              ...item,
                              runtimeRole: event.target.value as AgentRuntimeRole,
                              thought: getThoughtForRole(event.target.value as AgentRuntimeRole),
                              bubbleTone: "thinking"
                            }))
                          }
                          aria-label={`Runtime role for ${agent.name}`}
                        >
                          {(Object.keys(agentRuntimeRoleLabels) as AgentRuntimeRole[]).map((role) => (
                            <option key={role} value={role}>
                              {agentRuntimeRoleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="pixelToggleRow">
                        <input
                          type="checkbox"
                          checked={agent.autonomy}
                          onChange={(event) => updateAgent(agent.id, (item) => ({ ...item, autonomy: event.target.checked, thought: event.target.checked ? getThoughtForRole(item.runtimeRole) : "พักอยู่ที่จุดนี้" }))}
                        />
                        Think + wander when casual chat
                      </label>
                    </div>

                    <div className="quickActions">
                      <button type="button" onClick={() => setAgentMode(agent.id, "workflow")}>Workflow</button>
                      <button type="button" onClick={() => setAgentMode(agent.id, "wander")}>Free</button>
                      <button type="button" onClick={() => setAgentMode(agent.id, "manual")}>Lock</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {consoleMode === "agent" && activeMenu === "workflow" && (
            <section className="glassPanel workflowPanel compactPanel">
              <div className="panelTitleRow">
                <p className="miniLabel"><PixelIcon name="line" /> Workflow editor</p>
                <button type="button" className="tinyButton" onClick={() => setSceneMode("edit")}>
                  Edit scene
                </button>
              </div>
              <p className="helperText">เปิด Edit scene แล้วลาก node บนฉากได้ หรือกด + บนเส้นเพื่อแทรก step ระหว่างทาง</p>

              {selectedWorkflow && (
                <div className="editorStack">
                  <label className="fieldLabel" htmlFor="workflowTitle">Title</label>
                  <input id="workflowTitle" className="pixelInput" value={selectedWorkflow.title} onChange={(event) => updateWorkflowStep(selectedWorkflow.id, { title: event.target.value })} />

                  <label className="fieldLabel" htmlFor="workflowLabel">Short label</label>
                  <input id="workflowLabel" className="pixelInput" value={selectedWorkflow.label} onChange={(event) => updateWorkflowStep(selectedWorkflow.id, { label: event.target.value })} />

                  <label className="fieldLabel" htmlFor="workflowDescription">Description</label>
                  <textarea id="workflowDescription" value={selectedWorkflow.description} onChange={(event) => updateWorkflowStep(selectedWorkflow.id, { description: event.target.value })} />

                  <label className="fieldLabel" htmlFor="workflowStatus">Status text</label>
                  <input id="workflowStatus" className="pixelInput" value={selectedWorkflow.status} onChange={(event) => updateWorkflowStep(selectedWorkflow.id, { status: event.target.value })} />

                  <div className="rangeGrid">
                    <label>
                      X {Math.round(selectedWorkflow.x)}
                      <input type="range" min="8" max="92" value={selectedWorkflow.x} onChange={(event) => updateWorkflowStep(selectedWorkflow.id, { x: Number(event.target.value) })} />
                    </label>
                    <label>
                      Y {Math.round(selectedWorkflow.y)}
                      <input type="range" min="42" max="88" value={selectedWorkflow.y} onChange={(event) => updateWorkflowStep(selectedWorkflow.id, { y: Number(event.target.value) })} />
                    </label>
                  </div>

                  <div className="editorActions">
                    <button type="button" onClick={() => addWorkflowStep(workflowSteps.findIndex((step) => step.id === selectedWorkflow.id))}><PixelIcon name="plus" /> Add after</button>
                    <button type="button" onClick={() => reorderWorkflowStep(selectedWorkflow.id, -1)}><PixelIcon name="chevron-up" /> Up</button>
                    <button type="button" onClick={() => reorderWorkflowStep(selectedWorkflow.id, 1)}><PixelIcon name="chevron-down" /> Down</button>
                    <button type="button" className="danger" onClick={() => removeWorkflowStep(selectedWorkflow.id)} disabled={workflowSteps.length <= 1}><PixelIcon name="minus" /> Remove</button>
                  </div>
                </div>
              )}

              <div className="workflowList">
                {workflowSteps.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    className={selectedWorkflowId === step.id ? "selected" : ""}
                    onClick={() => {
                      setSelectedWorkflowId(step.id);
                      setActiveStep(index);
                    }}
                    style={{ "--marker-color": step.accent } as CSSProperties}
                  >
                    <span>{index + 1}</span>
                    <strong>{step.label}</strong>
                    <em>{step.title}</em>
                  </button>
                ))}
              </div>
            </section>
          )}

          {consoleMode === "agent" && activeMenu === "scene" && (
            <section className="glassPanel scenePanel compactPanel">
              <p className="miniLabel"><PixelIcon name="grid" /> Scene editor</p>
              <div className="modeSwitch">
                <button type="button" className={sceneMode === "play" ? "active" : ""} onClick={leaveSceneEditMode}>Play</button>
                <button type="button" className={sceneMode === "edit" ? "active" : ""} onClick={() => setSceneMode("edit")}>Edit</button>
              </div>
              <p className="helperText">ใช้สำหรับวาง object ในฉาก เช่น โต๊ะ terminal note หรือจุด interaction ในอนาคต</p>

              <div className="objectAddGrid">
                <button type="button" onClick={() => addSceneObject("table")}><PixelIcon name="cube" /> Table</button>
                <button type="button" onClick={() => addSceneObject("terminal")}><PixelIcon name="command" /> Terminal</button>
                <button type="button" onClick={() => addSceneObject("note")}><PixelIcon name="sticky-note" /> Note</button>
                <button type="button" onClick={() => addSceneObject("portal")}><PixelIcon name="sparkles" /> Portal</button>
              </div>

              <div className="deskPresetGrid">
                {deskObjectPresets.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => addDeskObject(preset)}>
                    <img src={preset.src} alt="" />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>

              {selectedObject && (
                <div className="editorStack objectEditor">
                  <label className="fieldLabel" htmlFor="objectLabel">Object label</label>
                  <input id="objectLabel" className="pixelInput" value={selectedObject.label} onChange={(event) => updateSceneObject(selectedObject.id, { label: event.target.value })} />
                  <div className="rangeGrid">
                    <label>
                      X {Math.round(selectedObject.x)}
                      <input type="range" min="4" max="96" value={selectedObject.x} onChange={(event) => updateSceneObject(selectedObject.id, { x: Number(event.target.value) })} />
                    </label>
                    <label>
                      Y {Math.round(selectedObject.y)}
                      <input type="range" min="36" max="90" value={selectedObject.y} onChange={(event) => updateSceneObject(selectedObject.id, { y: Number(event.target.value) })} />
                    </label>
                    <label>
                      W {Math.round(selectedObject.width)}
                      <input type="range" min="6" max="42" value={selectedObject.width} onChange={(event) => updateSceneObject(selectedObject.id, { width: Number(event.target.value) })} />
                    </label>
                    <label>
                      H {Math.round(selectedObject.height)}
                      <input type="range" min="4" max="28" value={selectedObject.height} onChange={(event) => updateSceneObject(selectedObject.id, { height: Number(event.target.value) })} />
                    </label>
                    <label className="wideRange">
                      Rotate {Math.round(selectedObject.rotation ?? 0)}°
                      <input type="range" min="-180" max="180" value={selectedObject.rotation ?? 0} onChange={(event) => updateSceneObject(selectedObject.id, { rotation: Number(event.target.value) })} />
                    </label>
                  </div>
                  <div className="editorActions rotateActions">
                    <button type="button" onClick={() => updateSceneObject(selectedObject.id, { rotation: clampPosition((selectedObject.rotation ?? 0) - 15, -180, 180) })}>Rotate -15°</button>
                    <button type="button" onClick={() => updateSceneObject(selectedObject.id, { rotation: clampPosition((selectedObject.rotation ?? 0) + 15, -180, 180) })}>Rotate +15°</button>
                    <button type="button" onClick={() => updateSceneObject(selectedObject.id, { rotation: 0 })}>Reset angle</button>
                    <button type="button" onClick={leaveSceneEditMode}>Done</button>
                  </div>
                  <button type="button" className="dangerButton" onClick={() => removeSceneObject(selectedObject.id)}>Remove object</button>
                </div>
              )}

              <div className="objectList">
                {sceneObjects.map((object) => (
                  <button
                    key={object.id}
                    type="button"
                    className={selectedObjectId === object.id ? "selected" : ""}
                    onClick={() => setSelectedObjectId(object.id)}
                    style={{ "--object-color": object.color } as CSSProperties}
                  >
                    <strong>{object.label}</strong>
                    <span>{object.type} · {Math.round(object.rotation ?? 0)}°</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {consoleMode === "agent" && activeMenu === "settings" && (
            <section className="glassPanel settingsPanel compactPanel">
              <p className="miniLabel"><PixelIcon name="wrench" /> Settings</p>

              <div className="configFileBanner">
                <strong>setting-config.json active</strong>
                <span>ค่า default / layer / workflow editor style ถูกแยกไว้ที่ <code>app/config/setting-config.json</code> เพื่อแก้ config ได้ง่ายขึ้น</span>
                <div className="configLayerGrid">
                  <code><span>sprites</span><b>{settingConfig.sceneLayers.sprites}</b></code>
                  <code><span>workflow</span><b>{settingConfig.sceneLayers.workflowMarkers}</b></code>
                  <code><span>objects</span><b>{settingConfig.sceneLayers.objects}</b></code>
                  <code><span>editor</span><b>{settingConfig.workflowEditor.style}</b></code>
                </div>
              </div>

              <div className="settingsBlock">
                <div className="panelTitleRow">
                  <div>
                    <h3>Scene background</h3>
                    <p className="helperText">เปลี่ยนภาพพื้นหลังของ live scene ได้ทันที และอัปโหลดภาพใหม่ไว้ทดสอบได้</p>
                  </div>
                  <div className="settingsActionGroup">
                    <span className="settingsBadge">{activeBackground.source}</span>
                    <button
                      type="button"
                      className="tinyButton"
                      onClick={() => {
                        setBackgroundFit("contain");
                        setBackgroundZoom(1);
                        setBackgroundImportStatus("ย่อภาพให้พอดีจอแล้ว (Fit to screen)");
                      }}
                    >
                      Fit to screen
                    </button>
                  </div>
                </div>

                <div
                  className="backgroundPreview"
                  style={{ backgroundImage: `url("${activeBackground.src}")`, backgroundSize, backgroundPosition: "center", backgroundRepeat: "no-repeat" } as CSSProperties}
                >
                  <span>{activeBackground.name}</span>
                </div>

                <div className="fitModeGrid" aria-label="Background fit mode">
                  {(Object.keys(backgroundFitLabels) as BackgroundFit[]).map((fit) => (
                    <button
                      key={fit}
                      type="button"
                      className={backgroundFit === fit ? "selected" : ""}
                      onClick={() => {
                        setBackgroundFit(fit);
                        setBackgroundImportStatus(`ปรับภาพเป็น ${backgroundFitLabels[fit].label}: ${backgroundFitLabels[fit].detail}`);
                      }}
                    >
                      <strong>{backgroundFitLabels[fit].label}</strong>
                      <span>{backgroundFitLabels[fit].detail}</span>
                    </button>
                  ))}
                </div>

                <div className="zoomControlGroup">
                  <label>
                    Zoom {backgroundZoom.toFixed(2)}x
                    <input
                      type="range"
                      min="0.6"
                      max="1.4"
                      step="0.02"
                      value={backgroundZoom}
                      onChange={(event) => {
                        const nextZoom = Number(event.target.value);
                        setBackgroundZoom(nextZoom);
                        setBackgroundImportStatus(`ปรับขนาดภาพพื้นหลังเป็น ${nextZoom.toFixed(2)}x`);
                      }}
                    />
                  </label>
                  <div className="zoomControlActions">
                    <button type="button" className="tinyButton" onClick={() => setBackgroundZoom(1)}>100%</button>
                    <button
                      type="button"
                      className="tinyButton"
                      onClick={() => {
                        setBackgroundFit("contain");
                        setBackgroundZoom(1);
                        setBackgroundImportStatus("ย่อภาพให้แสดงครบในหน้าจอแล้ว");
                      }}
                    >
                      Auto fit
                    </button>
                  </div>
                </div>

                <div className="backgroundLibrary">
                  {backgrounds.map((background) => (
                    <button
                      key={background.id}
                      type="button"
                      className={activeBackgroundId === background.id ? "selected" : ""}
                      onClick={() => {
                        setActiveBackgroundId(background.id);
                        setBackgroundImportStatus(`เปลี่ยน background เป็น: ${background.name}`);
                      }}
                    >
                      <span className="backgroundThumb" style={{ backgroundImage: `url("${background.src}")` } as CSSProperties} />
                      <strong>{background.name}</strong>
                      <em>{background.source}</em>
                    </button>
                  ))}
                </div>

                <label className="fileImportButton secondaryImportButton">
                  <PixelIcon name="image" />
                  Upload background
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={handleBackgroundImport} />
                </label>
                <span className="importStatus">{backgroundImportStatus}</span>
                <button type="button" className="dangerButton" onClick={resetSavedLayout}>Reset saved scene layout</button>
              </div>

              <div className="settingsBlock nestedPanel">
                <div className="panelTitleRow">
                  <div>
                    <p className="miniLabel"><PixelIcon name="grid" /> Scene control buttons</p>
                    <h3>Topbar และปุ่มใน scene</h3>
                    <p className="helperText">ลากจุดจับข้างปุ่มใน scene เพื่อย้ายตำแหน่งได้ทั้งหมด และสามารถซ่อน/เปิด topbar ได้</p>
                  </div>
                  <button type="button" className="tinyButton" onClick={() => { setTopHudPanel(initialTopHudPanel); setSceneButtonFrames(initialSceneButtonFrames); }}>Reset controls</button>
                </div>
                <div className="workflowFrameQuickActions">
                  <button type="button" className={topHudPanel.visible ? "active" : ""} onClick={() => updateTopHudPanel({ visible: !topHudPanel.visible })}>
                    {topHudPanel.visible ? "Hide topbar" : "Show topbar"}
                  </button>
                  <button type="button" onClick={() => setSceneMode("edit")}>Edit button positions</button>
                </div>
                <div className="rangeGrid workflowFrameControls">
                  <label>
                    Topbar X {Math.round(topHudPanel.x)}
                    <input type="range" min="0" max={Math.max(1, 99 - topHudPanel.width)} value={topHudPanel.x} onChange={(event) => updateTopHudPanel({ x: Number(event.target.value) })} />
                  </label>
                  <label>
                    Topbar Y {Math.round(topHudPanel.y)}
                    <input type="range" min="1" max={Math.max(1, 98 - topHudPanel.height)} value={topHudPanel.y} onChange={(event) => updateTopHudPanel({ y: Number(event.target.value) })} />
                  </label>
                  <label>
                    Topbar W {Math.round(topHudPanel.width)}
                    <input type="range" min="26" max="98" value={topHudPanel.width} onChange={(event) => updateTopHudPanel({ width: Number(event.target.value) })} />
                  </label>
                  <label>
                    Topbar H {Math.round(topHudPanel.height)}
                    <input type="range" min="10" max="44" value={topHudPanel.height} onChange={(event) => updateTopHudPanel({ height: Number(event.target.value) })} />
                  </label>
                </div>
              </div>

              <div className="settingsBlock nestedPanel">
                <div className="panelTitleRow">
                  <div>
                    <p className="miniLabel"><PixelIcon name="drag-horiozontal" /> Workflow frame</p>
                    <h3>ขยับกรอบ Workflow / Free-style Prompt</h3>
                    <p className="helperText">ลากที่แถบ Move workflow frame บนกรอบในฉาก หรือปรับค่า X/Y/Width ตรงนี้ได้อิสระ</p>
                  </div>
                  <button type="button" className="tinyButton" onClick={resetWorkflowDockFrame}>Reset</button>
                </div>
                <div className="workflowFrameQuickActions">
                  <button type="button" className={isWorkflowDockVisible ? "active" : ""} onClick={() => setIsWorkflowDockVisible((value) => !value)}>
                    {isWorkflowDockVisible ? "Hide frame" : "Show frame"}
                  </button>
                  <button type="button" className={isWorkflowDockCollapsed ? "active" : ""} onClick={() => setIsWorkflowDockCollapsed((value) => !value)} disabled={!isWorkflowDockVisible}>
                    {isWorkflowDockCollapsed ? "Expand frame" : "Collapse frame"}
                  </button>
                </div>
                <div className="rangeGrid workflowFrameControls">
                  <label>
                    X {Math.round(workflowDockFrame.x)}
                    <input type="range" min="1" max={Math.max(1, 99 - workflowDockFrame.width)} value={workflowDockFrame.x} onChange={(event) => updateWorkflowDockFrame({ x: Number(event.target.value) })} />
                  </label>
                  <label>
                    Y {Math.round(workflowDockFrame.y)}
                    <input type="range" min="5" max={Math.max(5, 98 - workflowDockFrame.height)} value={workflowDockFrame.y} onChange={(event) => updateWorkflowDockFrame({ y: Number(event.target.value) })} />
                  </label>
                  <label>
                    Width {Math.round(workflowDockFrame.width)}
                    <input type="range" min="28" max="96" value={workflowDockFrame.width} onChange={(event) => updateWorkflowDockFrame({ width: Number(event.target.value) })} />
                  </label>
                  <label>
                    Height {Math.round(workflowDockFrame.height)}
                    <input type="range" min="16" max="72" value={workflowDockFrame.height} onChange={(event) => updateWorkflowDockFrame({ height: Number(event.target.value) })} />
                  </label>
                </div>
              </div>

              <div className="settingsBlock nestedPanel">
                <div className="panelTitleRow">
                  <div>
                    <p className="miniLabel"><PixelIcon name="database" /> API model ↔ CLI settings</p>
                    <h3>Provider จาก .env จับคู่ CLI ให้ตรงกัน</h3>
                    <p className="helperText">API key ถูกอ่านฝั่ง server ผ่าน <code>/api/model-config</code> และส่งกลับเฉพาะสถานะ configured/missing เท่านั้น</p>
                  </div>
                  <button type="button" className="tinyButton" onClick={() => openModelConfigDialog(selectedModelProvider?.id, "api")}>
                    Config dialog
                  </button>
                </div>
                <div className="modelProviderGrid settingsProviderGrid apiCliProviderGrid">
                  {modelConfig.providers.map((provider) => {
                    const cliTool = cliAgentConfig.tools.find((tool) => tool.id === provider.cliId);
                    return (
                      <button key={provider.id} type="button" className={selectedModelProviderId === provider.id ? "selected" : ""} onClick={() => syncProviderWithCli(provider.id)}>
                        <strong>{provider.name}</strong>
                        <span>{provider.modelEnv} = {provider.defaultModel}</span>
                        <small>CLI → {cliTool?.name ?? provider.cliId}</small>
                        <em className={provider.apiKeyStatus}>{provider.apiKeyStatus === "configured" ? "configured" : `set ${provider.envKey}`}</em>
                      </button>
                    );
                  })}
                </div>
                <p className="helperText">รองรับ env: <code>GOOGLE_API_KEY</code>, <code>DEEPSEEK_API_KEY</code>, <code>QWEN_API_KEY</code>, <code>OPENAI_API_KEY</code> และ CLI pair เช่น <code>GEMINI_CLI_COMMAND</code>, <code>DEEPSEEK_CLI_COMMAND</code>, <code>QWEN_CLI_COMMAND</code>, <code>CODEX_CLI_COMMAND</code></p>
              </div>

              <div className="settingsBlock nestedPanel localRuntimeSettingsBlock">
                <p className="miniLabel"><PixelIcon name="home" /> Local small agent runtime</p>
                <h3>เตรียม setting สำหรับ agent คุยกันเอง</h3>
                <p className="helperText">ส่วนนี้เป็น configuration placeholder เท่านั้น ยังไม่ผูกกับปุ่ม chat หรือ workflow จริง เพื่อกัน local model ถูกเรียกโดยไม่ตั้งใจ</p>
                <div className="localRuntimeHero settingsLocalRuntimeHero">
                  <div>
                    <strong>{localAgentRuntimeConfig.providerLabel}</strong>
                    <span>{localAgentRuntimeConfig.baseUrlEnv}: {localAgentRuntimeConfig.baseUrl}</span>
                    <em>{localAgentRuntimeConfig.enabled ? "ENABLE_LOCAL_AGENT_RUNTIME=true" : "ENABLE_LOCAL_AGENT_RUNTIME=false"} · {enabledLocalRoleCount} role presets</em>
                  </div>
                  <span className="settingsBadge">standby</span>
                </div>
                <div className="localRoleGrid settingsLocalRoleGrid">
                  {localAgentRuntimeConfig.roles.map((role) => (
                    <button key={role.id} type="button" className={selectedLocalRoleId === role.id ? "selected" : ""} onClick={() => setSelectedLocalRoleId(role.id)}>
                      <strong>{role.label}</strong>
                      <span>{role.envKey} = {role.model}</span>
                      <em>{role.description}</em>
                    </button>
                  ))}
                </div>
                <p className="helperText">แนะนำ pull model ไว้ก่อน: <code>ollama pull qwen3:4b</code>, <code>ollama pull gemma3:1b</code>, <code>ollama pull qwen2.5-coder:3b</code></p>
              </div>

              <div className="settingsBlock nestedPanel">
                <p className="miniLabel"><PixelIcon name="command" /> OpenDesign CLI bridge</p>
                <h3>ใช้ CLI agent ที่ติดตั้งในเครื่อง</h3>
                <p className="helperText">เปิด bridge ด้วย <code>ENABLE_LOCAL_CLI_BRIDGE=true</code> แล้วเลือก default engine ด้วย <code>CLI_AGENT_DEFAULT</code> เช่น <code>codex</code>, <code>gemini</code>, <code>qwen</code>, <code>claude</code>, <code>opencode</code></p>
                <div className="cliToolGrid settingsCliGrid">
                  {cliAgentConfig.tools.map((tool) => (
                    <button key={tool.id} type="button" className={selectedCliId === tool.id ? "selected" : ""} onClick={() => setSelectedCliId(tool.id)}>
                      <strong>{tool.name}</strong>
                      <span>{tool.providerHint}</span>
                      <em className={tool.enabled ? "configured" : "missing"}>{tool.enabled ? tool.command : tool.commandEnv}</em>
                    </button>
                  ))}
                </div>
                <p className="helperText">ถ้า CLI ชื่อไม่ตรง PATH ให้ตั้ง <code>*_CLI_COMMAND</code> และ <code>*_CLI_ARGS</code> โดยใช้ placeholder <code>{'{prompt}'}</code></p>
              </div>

              <div className="settingsBlock nestedPanel">
                <p className="miniLabel"><PixelIcon name="folder" /> Sprite import</p>
                <h3>เพิ่ม Sprite จากไฟล์ zip</h3>
                <p className="helperText">รองรับ zip แบบตัวอย่าง: มี <code>pet.json</code> และ <code>spritesheet.webp</code> ใน layout Codex Pet</p>
                <label className="fileImportButton">
                  <PixelIcon name="plus" />
                  Import pet zip
                  <input type="file" accept=".zip,application/zip" onChange={handlePetImport} />
                </label>
                <a className="sampleLink" href="/examples/0798-keqing.zip" download>
                  ดาวน์โหลดตัวอย่าง Keqing zip
                </a>
                <span className="importStatus">{importStatus}</span>
              </div>

              <div className="petLibraryPanel settingsBlock nestedPanel">
                <p className="miniLabel"><PixelIcon name="database" /> Pet library</p>
                <div className="petLibraryList">
                  {petAssets.map((pet) => (
                    <button key={pet.id} type="button" onClick={() => spawnAgent(pet)}>
                      <strong>{pet.displayName}</strong>
                      <span>{pet.source === "built-in" ? "built-in" : "imported"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settingsBlock nestedPanel">
                <p className="miniLabel"><PixelIcon name="images" /> Pixel icons</p>
                <div className="iconShelf" aria-label="Pixel icon preview">
                  {iconPreview.map((icon) => (
                    <button key={icon} type="button" title={icon} aria-label={icon}>
                      <PixelIcon name={icon} />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {consoleMode === "agent" && activeMenu === "logs" && (
            <section className="glassPanel logPanel compactPanel">
              <p className="miniLabel"><PixelIcon name="list" /> Agent trace</p>
              <div className="activePanel inlineActive" style={{ "--active-color": current?.accent ?? "#42d9ff" } as CSSProperties}>
                <h3>{current?.title ?? "Workflow"}</h3>
                <p>{current?.status ?? "ยังไม่มี workflow step"}</p>
              </div>
              <div className="logList">
                {logs.map((log) => (
                  <div className="logItem" key={`${log.time}-${log.label}`}>
                    <time>{log.time}</time>
                    <div>
                      <strong>{log.label}</strong>
                      <p>{log.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>

      {isModelConfigDialogOpen && (
        <div className="configDialogOverlay" role="presentation" onMouseDown={() => setIsModelConfigDialogOpen(false)}>
          <section
            className="configDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-config-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="configDialogHeader">
              <div>
                <p className="miniLabel"><PixelIcon name="wrench" /> Detailed config</p>
                <h2 id="model-config-dialog-title">API model ↔ CLI mapping</h2>
                <span>ตั้งค่า provider, model, base URL และ CLI command ให้ตรงกันก่อนเชื่อมใช้งานจริง</span>
              </div>
              <button type="button" className="dialogCloseButton" onClick={() => setIsModelConfigDialogOpen(false)} aria-label="Close config dialog">×</button>
            </header>

            <div className="dialogTabSwitch" role="tablist" aria-label="Model config sections">
              <button type="button" className={modelConfigDialogTab === "api" ? "active" : ""} onClick={() => setModelConfigDialogTab("api")}>API pairs</button>
              <button type="button" className={modelConfigDialogTab === "cli" ? "active" : ""} onClick={() => setModelConfigDialogTab("cli")}>CLI bridge</button>
              <button type="button" className={modelConfigDialogTab === "env" ? "active" : ""} onClick={() => setModelConfigDialogTab("env")}>.env preview</button>
            </div>

            <div className="configDialogBody">
              <aside className="configPairList" aria-label="API and CLI providers">
                {apiCliPairRows.map(({ provider, cliTool }) => (
                  <button
                    key={provider.id}
                    type="button"
                    className={selectedModelProviderId === provider.id ? "selected" : ""}
                    onClick={() => syncProviderWithCli(provider.id)}
                  >
                    <strong>{provider.name}</strong>
                    <span>{provider.modelEnv} = {provider.defaultModel}</span>
                    <em>CLI → {cliTool?.name ?? provider.cliId}</em>
                  </button>
                ))}
              </aside>

              <section className="configDetailPane">
                {modelConfigDialogTab === "api" && (
                  <div className="configDetailGrid">
                    <div className="configDetailCard highlight">
                      <p className="miniLabel">Selected API</p>
                      <h3>{selectedModelProvider?.name}</h3>
                      <dl>
                        <div><dt>API key env</dt><dd><code>{selectedModelProvider?.envKey}</code></dd></div>
                        <div><dt>Base URL env</dt><dd><code>{selectedModelProvider?.baseUrlEnv}</code></dd></div>
                        <div><dt>Base URL</dt><dd>{selectedModelProvider?.baseUrl ?? "default"}</dd></div>
                        <div><dt>Model env</dt><dd><code>{selectedModelProvider?.modelEnv}</code></dd></div>
                        <div><dt>Model</dt><dd>{selectedModelProvider?.defaultModel}</dd></div>
                        <div><dt>Request style</dt><dd>{selectedModelProvider?.requestStyle}</dd></div>
                      </dl>
                    </div>
                    <div className="configDetailCard">
                      <p className="miniLabel">Matching CLI</p>
                      <h3>{selectedPairCliTool?.name ?? selectedModelProvider?.cliId}</h3>
                      <dl>
                        <div><dt>Status</dt><dd>{selectedPairCliTool?.enabled ? "detected / configured" : "waiting for CLI env"}</dd></div>
                        <div><dt>Command</dt><dd>{selectedPairCliTool?.command || "not set"}</dd></div>
                        <div><dt>Command env</dt><dd><code>{selectedPairCliTool?.commandEnv}</code></dd></div>
                        <div><dt>Args env</dt><dd><code>{selectedPairCliTool?.argsEnv}</code></dd></div>
                        <div><dt>Args template</dt><dd>{selectedPairCliTool?.argsPreview}</dd></div>
                        <div><dt>Provider hint</dt><dd>{selectedPairCliTool?.providerHint}</dd></div>
                      </dl>
                    </div>
                  </div>
                )}

                {modelConfigDialogTab === "cli" && (
                  <div className="configDetailCard wide">
                    <p className="miniLabel"><PixelIcon name="command" /> CLI bridge detail</p>
                    <h3>{cliAgentConfig.localBridgeEnabled ? "Bridge enabled" : "Bridge locked"}</h3>
                    <p className="helperText">CLI bridge จะ spawn process ฝั่ง Next server เฉพาะเมื่อ <code>ENABLE_LOCAL_CLI_BRIDGE=true</code> เท่านั้น ตอนนี้เน้น config ให้ API provider ตรงกับ CLI engine ก่อน</p>
                    <div className="cliMatrix">
                      {apiCliPairRows.map(({ provider, cliTool }) => (
                        <div key={`${provider.id}-${cliTool?.id ?? provider.cliId}`}>
                          <strong>{provider.name}</strong>
                          <span>{provider.defaultModel}</span>
                          <em>{cliTool?.name ?? provider.cliId}</em>
                          <code>{cliTool?.argsPreview ?? "{prompt}"}</code>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="primaryButton" onClick={runPromptWithSelectedCli} disabled={!prompt.trim() || isCliRunning}>
                      <PixelIcon name="command" /> {isCliRunning ? "Running..." : "Test selected CLI with prompt"}
                    </button>
                  </div>
                )}

                {modelConfigDialogTab === "env" && (
                  <div className="configDetailCard wide">
                    <p className="miniLabel"><PixelIcon name="document" /> .env.local preview</p>
                    <h3>{selectedModelProvider?.name} + {selectedPairCliTool?.name}</h3>
                    <p className="helperText">ค่าด้านล่างเป็น template สำหรับ provider ที่เลือก ไม่แสดง API key จริงจาก server</p>
                    <pre className="envPreviewBlock">{selectedEnvPreview}</pre>
                    <button type="button" className="primaryButton" onClick={copySelectedEnvPreview}>Copy selected .env template</button>
                  </div>
                )}
              </section>
            </div>

            <footer className="configDialogFooter">
              <span>{configDialogStatus}</span>
              <div>
                <button type="button" className="controlButton ghost" onClick={() => setIsModelConfigDialogOpen(false)}>Close</button>
                <button
                  type="button"
                  className="controlButton"
                  onClick={() => {
                    syncProviderWithCli(selectedModelProvider.id);
                    setConfigDialogStatus(`${selectedModelProvider.name} + ${selectedPairCliTool?.name ?? selectedModelProvider.cliId} พร้อมใช้เป็นคู่ config`);
                  }}
                >
                  Use this pair
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
