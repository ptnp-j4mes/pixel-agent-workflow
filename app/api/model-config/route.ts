import { NextResponse } from "next/server";

type ProviderId = "google" | "deepseek" | "qwen" | "codex";

type ProviderConfig = {
  id: ProviderId;
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

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function provider(config: Omit<ProviderConfig, "apiKeyStatus" | "enabled">, apiKeyEnv: string): ProviderConfig {
  const configured = hasEnv(apiKeyEnv);
  return {
    ...config,
    apiKeyStatus: configured ? "configured" : "missing",
    enabled: configured
  };
}

export async function GET() {
  const providers: ProviderConfig[] = [
    provider(
      {
        id: "google",
        name: "Google Gemini",
        envKey: "GOOGLE_API_KEY",
        baseUrl: process.env.GOOGLE_API_BASE_URL || "https://generativelanguage.googleapis.com",
        baseUrlEnv: "GOOGLE_API_BASE_URL",
        modelEnv: "GOOGLE_MODEL",
        defaultModel: process.env.GOOGLE_MODEL || "gemini-2.5-pro",
        cliId: "gemini",
        requestStyle: "Gemini REST / SDK"
      },
      "GOOGLE_API_KEY"
    ),
    provider(
      {
        id: "deepseek",
        name: "DeepSeek",
        envKey: "DEEPSEEK_API_KEY",
        baseUrl: process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com",
        baseUrlEnv: "DEEPSEEK_API_BASE_URL",
        modelEnv: "DEEPSEEK_MODEL",
        defaultModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        cliId: "deepseek",
        requestStyle: "OpenAI-compatible chat completions"
      },
      "DEEPSEEK_API_KEY"
    ),
    provider(
      {
        id: "qwen",
        name: "Qwen",
        envKey: "QWEN_API_KEY",
        baseUrl: process.env.QWEN_API_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        baseUrlEnv: "QWEN_API_BASE_URL",
        modelEnv: "QWEN_MODEL",
        defaultModel: process.env.QWEN_MODEL || "qwen-plus",
        cliId: "qwen",
        requestStyle: "OpenAI-compatible DashScope"
      },
      "QWEN_API_KEY"
    ),
    {
      id: "codex",
      name: "OpenAI / Codex",
      envKey: "OPENAI_API_KEY",
      baseUrl: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
      baseUrlEnv: "OPENAI_API_BASE_URL",
      modelEnv: "CODEX_MODEL",
      defaultModel: process.env.CODEX_MODEL || "codex-cli",
      cliId: "codex",
      requestStyle: "Codex CLI / OpenAI API compatible",
      apiKeyStatus: hasEnv("OPENAI_API_KEY") ? "configured" : "missing",
      enabled: hasEnv("OPENAI_API_KEY") || process.env.CODEX_CLI_ENABLED === "true"
    }
  ];

  const selectedProviderId = (process.env.DEFAULT_MODEL_PROVIDER as ProviderId | undefined) || "google";

  return NextResponse.json({
    providers,
    selectedProviderId: providers.some((item) => item.id === selectedProviderId) ? selectedProviderId : "google",
    codexCliEnabled: providers.find((item) => item.id === "codex")?.enabled ?? false
  });
}
