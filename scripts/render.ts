// render.ts — one local sketch render at a time, under a memory guard, one log row per render; `run` or `status`.
// PIX_RENDER_COMMAND replaces the model call and PIX_RENDER_MEMORY the kernel reading, so the probe loads no model.
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { judgeMemory } from './lib/render/judge-memory.ts';
import { logRow } from './lib/render/log-row.ts';
import { readMemory } from './lib/render/read-memory.ts';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const dir = join(root, 'renders');
const logFile = join(dir, 'renders.tsv');
const outputFile = join(dir, 'current.out');
const lockFile = join(dir, 'current.lock');
const model = 'mlx-community/qwen-image-edit-2511-8bit';
const steps = 8;
const [command = '', ...args] = process.argv.slice(2);
const option = (name: string): string | undefined => {
	const at = args.indexOf(name);
	return at === -1 ? undefined : args[at + 1];
};
// A smaller size lowers the memory peak while the model loads; a sketch does not need more.
const size = { width: Number(option('--width') ?? '768'), height: Number(option('--height') ?? '1024') };

function fail(message: string): never {
	process.stderr.write(`${message}\n`);
	process.exit(1);
}

function lastStep(): string {
	const text = existsSync(outputFile) ? readFileSync(outputFile, 'utf8').replaceAll('\r', '\n') : '';
	return [...text.matchAll(/ ([0-9]+)\/([0-9]+) \[([^\]]*)\]/g)].at(-1)?.[0].trim() ?? '';
}

function status(): void {
	const memory = readMemory();
	const running = existsSync(lockFile) ? `running ${readFileSync(lockFile, 'utf8').trim()} · ${lastStep() || 'loading'}` : 'idle';
	const rows = existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').slice(-5) : [];
	process.stdout.write(
		[running, `memory pressure ${String(memory.pressure)} · swap ${String(memory.swapMb)} MB`, ...rows].join('\n') + '\n',
	);
}

function modelCommand(input: string, prompt: string, output: string, seed: number): string[] {
	const forced = process.env['PIX_RENDER_COMMAND'];
	if (forced !== undefined && forced !== '') return ['sh', '-c', forced, 'render', output];
	const snapshots = join(homedir(), '.cache/huggingface/hub/models--lightx2v--Qwen-Image-Edit-2511-Lightning/snapshots');
	const snapshot = existsSync(snapshots) ? readdirSync(snapshots)[0] : undefined;
	if (snapshot === undefined) fail(`The Lightning LoRA is missing under ${snapshots}.`);
	const lora = join(snapshots, snapshot, 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors');
	return [
		join(homedir(), '.local/bin/mflux-generate-qwen-edit'),
		...['--model', model, '--base-model', 'qwen-image-edit', '--image-paths', input, '--prompt-file', prompt],
		...['--guidance', '1.0', '--lora-paths', lora, '--lora-scales', '1.0', '--no-bake-lora', '--steps', String(steps)],
		...['--seed', String(seed), '--height', String(size.height), '--width', String(size.width)],
		...['--vae-tiling', '--vae-tile-size', '256', '--mlx-cache-limit-gb', '4', '--output', output],
	];
}

function run(): void {
	const input = option('--input');
	const prompt = option('--prompt');
	const name = option('--name');
	const seed = Number(option('--seed') ?? '11');
	if (input === undefined || prompt === undefined || name === undefined || !/^[a-z0-9-]+$/.test(name))
		fail('usage: node scripts/render.ts run --input <png> --prompt <txt> --name <lowercase-name> [--seed N] [--width W --height H]');
	mkdirSync(dir, { recursive: true });
	if (existsSync(lockFile)) fail(`refused: a render is running (${readFileSync(lockFile, 'utf8').trim()})`);
	const start = readMemory();
	const entry = judgeMemory(false, start.pressure, 0);
	if (entry.action !== 'go') fail(`refused: ${entry.reason}`);
	const output = join(dir, `${name}-s${String(seed)}.png`);
	const [binary = '', ...rest] = modelCommand(input, prompt, output, seed);
	writeFileSync(lockFile, `${name}·s${String(seed)}`);
	writeFileSync(outputFile, '');
	const startedAt = Date.now();
	let firstStepAt: number | null = null;
	let peakPressure = start.pressure;
	let swapPeakMb = 0;
	let result = 'done';
	const child = spawn(binary, rest, { stdio: ['ignore', 'pipe', 'pipe'] });
	const keep = (chunk: Buffer): void => {
		appendFileSync(outputFile, chunk);
		if (firstStepAt === null && / [1-9][0-9]*\/[0-9]+ \[/.test(chunk.toString())) firstStepAt = Date.now();
	};
	child.stdout.on('data', keep);
	child.stderr.on('data', keep);
	const watch = setInterval(() => {
		const now = readMemory();
		peakPressure = Math.max(peakPressure, now.pressure);
		swapPeakMb = Math.max(swapPeakMb, now.swapMb - start.swapMb);
		const verdict = judgeMemory(true, now.pressure, now.swapMb - start.swapMb);
		if (verdict.action === 'abort') {
			result = `ABORT: ${verdict.reason}`;
			child.kill('SIGTERM');
		}
	}, Number(process.env['PIX_RENDER_INTERVAL_MS'] ?? '5000'));
	child.on('exit', (code) => {
		clearInterval(watch);
		if (result === 'done' && (code !== 0 || !existsSync(output))) result = `FAILED: exit ${String(code)}`;
		const perStep = /([0-9.]+)s\/it/.exec(lastStep())?.[1];
		appendFileSync(
			logFile,
			logRow({
				date: new Date().toISOString().slice(0, 16).replace('T', ' '),
				name,
				seed,
				model,
				steps,
				size: `${String(size.width)}x${String(size.height)}`,
				firstStepSeconds: firstStepAt === null ? null : Math.round((firstStepAt - startedAt) / 1000),
				totalSeconds: Math.round((Date.now() - startedAt) / 1000),
				secondsPerStep: perStep === undefined ? null : Number(perStep),
				peakPressure,
				swapPeakMb,
				result,
			}) + '\n',
		);
		writeFileSync(lockFile, '');
		execFileSync('rm', ['-f', lockFile]);
		process.stdout.write(`${name}·s${String(seed)}: ${result}\n`);
		process.exit(result === 'done' ? 0 : 2);
	});
}

if (command === 'run') run();
else if (command === 'status') status();
else fail('usage: node scripts/render.ts run|status');
