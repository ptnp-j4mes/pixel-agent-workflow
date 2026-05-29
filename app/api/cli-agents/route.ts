import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CliToolId = "claude" | "codex" | "gemini" | "opencode" | "qwen" | "deepseek" | "cursor" | "custom";

type CliCandidate = {
  id: CliToolId;
  name: string;
  defaultCommand: string;
  commandEnv: string;
  argsEnv: string;
  defaultArgs: string;
  providerHint: string;
};

const candidates: CliCandidate[] = [
  { id: "claude", name: "Claude Code", defaultCommand: "claude", commandEnv: "CLAUDE_CLI_COMMAND", argsEnv: "CLAUDE_CLI_ARGS", defaultArgs: "-p {prompt}", providerHint: "Anthropic / Claude" },
  { id: "codex", name: "Codex CLI", defaultCommand: "codex", commandEnv: "CODEX_CLI_COMMAND", argsEnv: "CODEX_CLI_ARGS", defaultArgs: "exec {prompt}", providerHint: "OpenAI / Codex" },
  { id: "gemini", name: "Gemini CLI", defaultCommand: "gemini", commandEnv: "GEMINI_CLI_COMMAND", argsEnv: "GEMINI_CLI_ARGS", defaultArgs: "-p {prompt}", providerHint: "Google / Gemini" },
  { id: "opencode", name: "OpenCode", defaultCommand: "opencode", commandEnv: "OPENCODE_CLI_COMMAND", argsEnv: "OPENCODE_CLI_ARGS", defaultArgs: "run {prompt}", providerHint: "OpenCode / OpenAI-compatible" },
  { id: "qwen", name: "Qwen Code", defaultCommand: "qwen", commandEnv: "QWEN_CLI_COMMAND", argsEnv: "QWEN_CLI_ARGS", defaultArgs: "-p {prompt}", providerHint: "Alibaba / Qwen" },
  { id: "deepseek", name: "DeepSeek TUI", defaultCommand: "deepseek", commandEnv: "DEEPSEEK_CLI_COMMAND", argsEnv: "DEEPSEEK_CLI_ARGS", defaultArgs: "{prompt}", providerHint: "DeepSeek" },
  { id: "cursor", name: "Cursor Agent", defaultCommand: "cursor-agent", commandEnv: "CURSOR_AGENT_COMMAND", argsEnv: "CURSOR_AGENT_ARGS", defaultArgs: "{prompt}", providerHint: "Cursor" },
  { id: "custom", name: "Custom Local Agent", defaultCommand: "", commandEnv: "CUSTOM_AGENT_COMMAND", argsEnv: "CUSTOM_AGENT_ARGS", defaultArgs: "{prompt}", providerHint: "Any local CLI" }
];

function commandExists(command: string) {
  if (!command.trim()) return false;
  const result = spawnSync("sh", ["-lc", `command -v ${JSON.stringify(command)} >/dev/null 2>&1`], {
    stdio: "ignore",
    timeout: 2000
  });
  return result.status === 0;
}

function getConfiguredCommand(candidate: CliCandidate) {
  return process.env[candidate.commandEnv]?.trim() || candidate.defaultCommand;
}

export async function GET() {
  const tools = candidates.map((candidate) => {
    const command = getConfiguredCommand(candidate);
    const installed = commandExists(command);
    const argsTemplate = process.env[candidate.argsEnv]?.trim() || candidate.defaultArgs;
    return {
      id: candidate.id,
      name: candidate.name,
      command,
      commandEnv: candidate.commandEnv,
      argsEnv: candidate.argsEnv,
      argsPreview: argsTemplate,
      providerHint: candidate.providerHint,
      installed,
      enabled: installed || Boolean(process.env[candidate.commandEnv]?.trim())
    };
  });

  const selectedCliId = process.env.CLI_AGENT_DEFAULT || tools.find((tool) => tool.enabled)?.id || "custom";

  return NextResponse.json({
    localBridgeEnabled: process.env.ENABLE_LOCAL_CLI_BRIDGE === "true",
    selectedCliId: tools.some((tool) => tool.id === selectedCliId) ? selectedCliId : "custom",
    tools
  });
}
