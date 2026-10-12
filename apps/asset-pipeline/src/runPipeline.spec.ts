import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runPipeline } from './runPipeline.ts';

const lora = '/hub/lightning.safetensors';

/** Runs one command with a throwaway renders folder and collects what it writes. */
async function run(
	argv: readonly string[],
	env: Record<string, string> = {},
): Promise<{ code: number; out: string; err: string }> {
	let out = '';
	let err = '';
	const rendersDir = mkdtempSync(join(tmpdir(), 'pipeline-'));
	const code = await runPipeline(
		argv,
		{ PIX_RENDERS_DIR: rendersDir, PIX_LORA: lora, ...env },
		{ write: (text) => (out += text) },
		{ write: (text) => (err += text) },
		() => ({ pressure: 1, swapMb: 0 }),
	);
	return { code, out, err };
}

describe('runPipeline', () => {
	it('shows the status of an idle renderer', async () => {
		expect((await run(['status'])).out.split('\n')[0]).toBe('idle');
	});

	it('renders through the wired adapter', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'mflux-'));
		const mflux = join(dir, 'mflux');
		writeFileSync(mflux, '#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = "--output" ] && printf x > "$2"; shift; done\n');
		chmodSync(mflux, 0o755);
		const result = await run(['render', 'figure.txt', 'figure.png', '11'], { PIX_MFLUX: mflux });
		expect([result.code, result.out.split('\n')[0]]).toEqual([0, 'done figure-s11']);
	});

	it('answers the table code and message of a render failure', async () => {
		const result = await run(['render', 'figure.txt', 'figure.png', 'eleven']);
		expect(result.code).toBe(4);
		expect(result.err).toContain('The render job is invalid (render.invalid_job)');
	});

	it('stops at the start with the configuration code when the weights are missing', async () => {
		const result = await run(['status'], { PIX_LORA: '/hub/missing' });
		expect([result.code, result.err.includes('render.invalid_config')]).toEqual([3, true]);
	});

	it('answers 2 and the usage for an unknown command', async () => {
		const result = await run(['dance']);
		expect([result.code, result.err.startsWith('usage:')]).toEqual([2, true]);
	});
});
