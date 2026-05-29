import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocalAgentRoleId = "planner" | "chat" | "coder" | "critic";

type LocalAgentRoleConfig = {
  id: LocalAgentRoleId;
  label: string;
  envKey: string;
  model: string;
  description: string;
  enabled: boolean;
};

function env(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

function boolEnv(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export async function GET() {
  const baseUrl = env("OLLAMA_BASE_URL", "http://localhost:11434");
  const enabled = boolEnv("ENABLE_LOCAL_AGENT_RUNTIME");

  const roles: LocalAgentRoleConfig[] = [
    {
      id: "planner",
      label: "Planner Agent",
      envKey: "LOCAL_PLANNER_MODEL",
      model: env("LOCAL_PLANNER_MODEL", "qwen3:4b"),
      description: "วางแผน workflow / แตก task",
      enabled: boolEnv("LOCAL_PLANNER_ENABLED") || process.env.LOCAL_PLANNER_ENABLED === undefined
    },
    {
      id: "chat",
      label: "Sprite Chat",
      envKey: "LOCAL_CHAT_MODEL",
      model: env("LOCAL_CHAT_MODEL", "gemma3:1b"),
      description: "บทสนทนาเบา ๆ ของ sprite",
      enabled: boolEnv("LOCAL_CHAT_ENABLED") || process.env.LOCAL_CHAT_ENABLED === undefined
    },
    {
      id: "coder",
      label: "Coder Agent",
      envKey: "LOCAL_CODER_MODEL",
      model: env("LOCAL_CODER_MODEL", "qwen2.5-coder:3b"),
      description: "ช่วยแก้ code / scene config",
      enabled: boolEnv("LOCAL_CODER_ENABLED") || process.env.LOCAL_CODER_ENABLED === undefined
    },
    {
      id: "critic",
      label: "Critic Agent",
      envKey: "LOCAL_CRITIC_MODEL",
      model: env("LOCAL_CRITIC_MODEL", "deepseek-r1:1.5b"),
      description: "ตรวจแผนและหา risk",
      enabled: boolEnv("LOCAL_CRITIC_ENABLED") || process.env.LOCAL_CRITIC_ENABLED === undefined
    }
  ];

  return NextResponse.json({
    provider: "ollama",
    providerLabel: "Ollama local runtime",
    enabled,
    readyForUse: false,
    baseUrl,
    baseUrlEnv: "OLLAMA_BASE_URL",
    baseUrlStatus: process.env.OLLAMA_BASE_URL?.trim() ? "configured" : "default",
    defaultModel: env("LOCAL_DEFAULT_MODEL", "qwen3:4b"),
    roles,
    executionMode: "settings-only"
  });
}
