import { spawnSync } from 'node:child_process';

const tools = [
  ['claude', 'Claude Code'],
  ['codex', 'Codex CLI'],
  ['gemini', 'Gemini CLI'],
  ['opencode', 'OpenCode'],
  ['qwen', 'Qwen Code'],
  ['deepseek', 'DeepSeek TUI'],
  ['cursor-agent', 'Cursor Agent']
];

for (const [bin, label] of tools) {
  const result = spawnSync('sh', ['-lc', `command -v ${bin}`], { encoding: 'utf8' });
  const found = result.status === 0;
  console.log(`${found ? 'OK' : '--'} ${label.padEnd(18)} ${found ? result.stdout.trim() : 'not found'}`);
}
