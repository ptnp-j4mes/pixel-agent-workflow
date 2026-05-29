export type PetAnimationMap = {
  idleRow: number;
  runRightRow: number;
  runLeftRow: number;
  idleFrames: number;
  runFrames: number;
};

export type PetAsset = {
  id: string;
  displayName: string;
  description: string;
  kind: string;
  spritesheetUrl: string;
  source: "built-in" | "imported";
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  animation: PetAnimationMap;
};

export type AgentMode = "workflow" | "wander" | "manual";
export type AgentRuntimeRole = "planner" | "chat" | "coder" | "critic";
export type AgentBubbleTone = "idle" | "thinking" | "chat" | "workflow";

export type AgentSprite = {
  id: string;
  name: string;
  role: string;
  status: string;
  petId: string;
  mode: AgentMode;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  direction: "left" | "right";
  isMoving: boolean;
  stepOffset: number;
  speed: number;
  color: string;
  runtimeRole: AgentRuntimeRole;
  autonomy: boolean;
  thought: string;
  bubbleTone: AgentBubbleTone;
};

export const DEFAULT_ANIMATION: PetAnimationMap = {
  idleRow: 0,
  runRightRow: 1,
  runLeftRow: 2,
  idleFrames: 6,
  runFrames: 8
};

export const builtInPets: PetAsset[] = [
  {
    id: "lumina",
    displayName: "Lumina",
    description: "Pixel-art assistant sprite in the Codex Pet layout.",
    kind: "person",
    spritesheetUrl: "/pets/lumina/spritesheet.webp",
    source: "built-in",
    frameWidth: 192,
    frameHeight: 208,
    columns: 8,
    rows: 9,
    animation: DEFAULT_ANIMATION
  },
  {
    id: "keqing",
    displayName: "Keqing",
    description: "A Keqing-inspired compact pixel-art beautiful girl assistant for Codex.",
    kind: "person",
    spritesheetUrl: "/pets/keqing/spritesheet.webp",
    source: "built-in",
    frameWidth: 192,
    frameHeight: 208,
    columns: 8,
    rows: 9,
    animation: DEFAULT_ANIMATION
  }
];

export function createAgentSprite(params: {
  id: string;
  name: string;
  role: string;
  petId: string;
  mode: AgentMode;
  x: number;
  y: number;
  stepOffset?: number;
  color?: string;
  speed?: number;
  runtimeRole?: AgentRuntimeRole;
  autonomy?: boolean;
  thought?: string;
}): AgentSprite {
  return {
    id: params.id,
    name: params.name,
    role: params.role,
    status: params.mode === "wander" ? "เดินสำรวจพื้นที่และรอรับงาน" : "เชื่อมกับ workflow node",
    petId: params.petId,
    mode: params.mode,
    x: params.x,
    y: params.y,
    targetX: params.x,
    targetY: params.y,
    direction: "right",
    isMoving: false,
    stepOffset: params.stepOffset ?? 0,
    speed: params.speed ?? 14,
    color: params.color ?? "#42d9ff",
    runtimeRole: params.runtimeRole ?? "chat",
    autonomy: params.autonomy ?? true,
    thought: params.thought ?? (params.mode === "workflow" ? "กำลังอ่าน workflow node" : "พร้อมคุยเล่นแบบ casual"),
    bubbleTone: params.mode === "workflow" ? "workflow" : "idle"
  };
}

export function clampPosition(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function randomStagePoint() {
  return {
    x: 12 + Math.random() * 76,
    y: 50 + Math.random() * 32
  };
}
