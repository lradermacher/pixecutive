import { EventEmitter } from 'node:events';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RenderMachineLocalAdapter } from '@pixecutive/infrastructure';
import { describe, expect, it } from 'vitest';
import { runPipeline } from './runPipeline.ts';

/** A prompt and an input image that exist, as a render checks before it starts the model. */
const inputs = mkdtempSync(join(tmpdir(), 'inputs-'));
const prompt = join(inputs, 'figure.txt');
const image = join(inputs, 'figure.png');
writeFileSync(prompt, 'a prompt');
writeFileSync(image, 'an image');

/** A LoRA file that exists, so the configuration starts. */
function loraFile(): string {
	const path = join(mkdtempSync(join(tmpdir(), 'lora-')), 'lightning.safetensors');
	writeFileSync(path, '');
	return path;
}

/** An mflux that writes the image named after `--output`. */
function fakeMflux(): string {
	const mflux = join(mkdtempSync(join(tmpdir(), 'mflux-')), 'mflux');
	writeFileSync(mflux, '#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = "--output" ] && printf x > "$2"; shift; done\n');
	chmodSync(mflux, 0o755);
	return mflux;
}

/** This machine, except that its repo lies in `root`. */
class MachineWithRepoAt extends RenderMachineLocalAdapter {
	constructor(private readonly root: string) {
		super();
	}

	override repoRoot(): string {
		return this.root;
	}
}

/** Runs one command, with a throwaway renders folder unless `configuredRenders` is false, and collects its output. */
async function run(
	argv: readonly string[],
	env: Record<string, string> = {},
	interrupts: EventEmitter = new EventEmitter(),
	machine = new RenderMachineLocalAdapter(),
	configuredRenders = true,
): Promise<{ code: number; out: string; err: string }> {
	let out = '';
	let err = '';
	const renders = configuredRenders ? { PIX_RENDERS_DIR: mkdtempSync(join(tmpdir(), 'pipeline-')) } : {};
	const code = await runPipeline(
		argv,
		{ ...renders, PIX_MFLUX: fakeMflux(), PIX_LORA: loraFile(), ...env },
		{ write: (text) => (out += text) },
		{ write: (text) => (err += text) },
		() => ({ pressure: 1, swapMb: 0 }),
		interrupts,
		machine,
	);
	return { code, out, err };
}

describe('runPipeline', () => {
	it('shows the status of an idle renderer', async () => {
		expect((await run(['status'])).out.split('\n')[0]).toBe('idle');
	});

	it('renders through the wired adapter', async () => {
		const result = await run(['render', prompt, image, '11']);
		expect([result.code, result.out.split('\n')[0]]).toEqual([0, 'done figure-s11']);
	});

	it('logs the render with the time it ended, read by the adapter itself', async () => {
		const renders = mkdtempSync(join(tmpdir(), 'pipeline-'));
		const before = new Date().toISOString().slice(0, 10);
		await run(['render', prompt, image, '11'], { PIX_RENDERS_DIR: renders });
		const row = readFileSync(join(renders, 'renders.tsv'), 'utf8').trim().split('\t');
		expect(row[0]?.slice(0, 10)).toBe(before);
	});

	it('answers the table code and message of a render failure', async () => {
		const result = await run(['render', prompt, image, 'eleven']);
		expect(result.code).toBe(4);
		expect(result.err.split('\n')[0]).toMatch(/^The render job is invalid \(render\.invalid_job\): .+/);
	});

	it('stops at the start with the configuration code when the weights are missing', async () => {
		const result = await run(['status'], { PIX_LORA: '/hub/missing' });
		expect([result.code, result.err.includes('render.invalid_config')]).toEqual([3, true]);
	});

	it('answers the interrupted code when Ctrl-C arrives during a render', async () => {
		const mflux = join(mkdtempSync(join(tmpdir(), 'mflux-')), 'mflux');
		writeFileSync(mflux, '#!/bin/sh\nsleep 2\n');
		chmodSync(mflux, 0o755);
		const interrupts = new EventEmitter();
		setTimeout(() => interrupts.emit('SIGINT'), 300);
		const result = await run(['render', prompt, image, '11'], { PIX_MFLUX: mflux }, interrupts);
		expect([result.code, result.err.includes('render.interrupted')]).toEqual([9, true]);
	});

	it('renders into the repo of the machine when no renders folder is configured', async () => {
		const root = mkdtempSync(join(tmpdir(), 'repo-'));
		const machine = new MachineWithRepoAt(root);
		const result = await run(['render', prompt, image, '11'], {}, new EventEmitter(), machine, false);
		expect([result.code, result.out.split('\n')[1]]).toEqual([0, join(root, 'renders', 'figure-s11.png')]);
	});

	it('answers a motion chain failure with its own code from the figure table', async () => {
		const result = await run(['track', 'f', 'idle'], { PIX_LTX_MODEL: '/hub/ltx' });
		expect([result.code, result.err.split('\n')[0]]).toEqual([
			13,
			'The figure job is invalid (figure.invalid_job): no cut of f idle: run `pnpm assets frames f idle` first',
		]);
	});

	it('answers the usage for an unknown command before it reads the configuration', async () => {
		const result = await run(['dance'], { PIX_LORA: '/hub/missing' });
		expect([result.code, result.err.startsWith('usage:')]).toEqual([2, true]);
	});

	it('takes a command only in its exact spelling', async () => {
		expect((await run(['Status'])).code).toBe(2);
	});

	it('answers 2 and the usage for an unknown command', async () => {
		const result = await run(['dance']);
		expect([result.code, result.err.startsWith('usage:')]).toEqual([2, true]);
	});
});
