import { spawn } from 'node:child_process';

const prompt = process.argv.slice(2).join(' ').trim();
if (!prompt) {
  console.error('Usage: npm run agent:run -- "your prompt"');
  process.exit(1);
}

const id = process.env.CLI_AGENT_DEFAULT || 'codex';
const command = process.env[`${id.toUpperCase()}_CLI_COMMAND`] || id;
const argsTemplate = process.env[`${id.toUpperCase()}_CLI_ARGS`] || (id === 'codex' ? 'exec {prompt}' : '{prompt}');
const args = argsTemplate.split(/\s+/).map((arg) => arg.replaceAll('{prompt}', prompt));
if (!args.some((arg) => arg.includes(prompt))) args.push(prompt);

console.log(`Running ${command} ${args.map((arg) => (arg.includes(' ') ? JSON.stringify(arg) : arg)).join(' ')}`);
const child = spawn(command, args, { stdio: 'inherit', shell: false, env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
