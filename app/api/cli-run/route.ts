import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";

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
};

const candidates: CliCandidate[] = [
  { id: "claude", name: "Claude Code", defaultCommand: "claude", commandEnv: "CLAUDE_CLI_COMMAND", argsEnv: "CLAUDE_CLI_ARGS", defaultArgs: "-p {prompt}" },
  { id: "codex", name: "Codex CLI", defaultCommand: "codex", commandEnv: "CODEX_CLI_COMMAND", argsEnv: "CODEX_CLI_ARGS", defaultArgs: "exec {prompt}" },
  { id: "gemini", name: "Gemini CLI", defaultCommand: "gemini", commandEnv: "GEMINI_CLI_COMMAND", argsEnv: "GEMINI_CLI_ARGS", defaultArgs: "-p {prompt}" },
  { id: "opencode", name: "OpenCode", defaultCommand: "opencode", commandEnv: "OPENCODE_CLI_COMMAND", argsEnv: "OPENCODE_CLI_ARGS", defaultArgs: "run {prompt}" },
  { id: "qwen", name: "Qwen Code", defaultCommand: "qwen", commandEnv: "QWEN_CLI_COMMAND", argsEnv: "QWEN_CLI_ARGS", defaultArgs: "-p {prompt}" },
  { id: "deepseek", name: "DeepSeek TUI", defaultCommand: "deepseek", commandEnv: "DEEPSEEK_CLI_COMMAND", argsEnv: "DEEPSEEK_CLI_ARGS", defaultArgs: "{prompt}" },
  { id: "cursor", name: "Cursor Agent", defaultCommand: "cursor-agent", commandEnv: "CURSOR_AGENT_COMMAND", argsEnv: "CURSOR_AGENT_ARGS", defaultArgs: "{prompt}" },
  { id: "custom", name: "Custom Local Agent", defaultCommand: "", commandEnv: "CUSTOM_AGENT_COMMAND", argsEnv: "CUSTOM_AGENT_ARGS", defaultArgs: "{prompt}" }
];

function tokenizeArgs(input: string) {
  const tokens: string[] = [];
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) {
    tokens.push((match[1] ?? match[2] ?? match[0]).replace(/\\(["'\\])/g, "$1"));
  }
  return tokens;
}

function buildArgs(template: string, prompt: string) {
  const tokens = tokenizeArgs(template);
  if (tokens.length === 0) return [prompt];
  const hasPromptSlot = tokens.some((token) => token.includes("{prompt}"));
  const args = tokens.map((token) => token.replaceAll("{prompt}", prompt));
  return hasPromptSlot ? args : [...args, prompt];
}

export async function POST(request: NextRequest) {
  if (process.env.ENABLE_LOCAL_CLI_BRIDGE !== "true") {
    return NextResponse.json(
      {
        ok: false,
        error: "Local CLI bridge is disabled. Set ENABLE_LOCAL_CLI_BRIDGE=true in .env.local to allow server-side CLI execution.",
        skipped: true
      },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as { cliId?: CliToolId; prompt?: string; agentName?: string } | null;
  const prompt = body?.prompt?.trim();
  if (!prompt) return NextResponse.json({ ok: false, error: "Prompt is required" }, { status: 400 });
  if (prompt.length > 8000) return NextResponse.json({ ok: false, error: "Prompt is too long" }, { status: 400 });

  const candidate = candidates.find((item) => item.id === body?.cliId) ?? candidates.find((item) => item.id === process.env.CLI_AGENT_DEFAULT) ?? candidates[0];
  const command = process.env[candidate.commandEnv]?.trim() || candidate.defaultCommand;
  if (!command) {
    return NextResponse.json({ ok: false, error: `Set ${candidate.commandEnv} for ${candidate.name}` }, { status: 400 });
  }

  const argsTemplate = process.env[candidate.argsEnv]?.trim() || candidate.defaultArgs;
  const args = buildArgs(argsTemplate, prompt);
  const startedAt = Date.now();

  return await new Promise<NextResponse>((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: false,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const maxOutput = 80_000;
    const killTimer = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += "\n[timeout] CLI process exceeded LOCAL_CLI_TIMEOUT_MS.\n";
    }, Number(process.env.LOCAL_CLI_TIMEOUT_MS || 120000));

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = (stdout + chunk.toString()).slice(-maxOutput);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-maxOutput);
    });
    child.on("error", (error) => {
      clearTimeout(killTimer);
      resolve(NextResponse.json({ ok: false, error: error.message, commandLabel: `${command} ${args.join(" ")}` }, { status: 500 }));
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve(
        NextResponse.json({
          ok: code === 0,
          cliId: candidate.id,
          cliName: candidate.name,
          commandLabel: `${command} ${args.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg)).join(" ")}`,
          stdout,
          stderr,
          exitCode: code,
          durationMs: Date.now() - startedAt
        })
      );
    });
  });
}
