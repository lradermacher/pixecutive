import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runPipeline } from './runPipeline.ts';

/** Runs one command with a throwaway renders folder and collects what it writes. */
async function run(argv: readonly string[]): Promise<{ code: number; out: string; err: string }> {
	let out = '';
	let err = '';
	const env = { PIX_RENDERS_DIR: mkdtempSync(join(tmpdir(), 'pipeline-')) };
	const code = await runPipeline(argv, env, { write: (text) => (out += text) }, { write: (text) => (err += text) });
	return { code, out, err };
}

describe('runPipeline', () => {
	it('prints the prompt of a dry reference run', async () => {
		const result = await run(['reference', 'base-m', '--dry']);
		expect(result.code).toBe(0);
		expect(result.out).toContain('chroma-key green');
	});

	it('answers 2 and the key for an asset failure', async () => {
		const result = await run(['reference', 'base-x', '--dry']);
		expect(result.code).toBe(2);
		expect(result.err).toContain('asset.invalid_data');
	});

	it('shows the status of an idle guard', async () => {
		expect((await run(['status'])).out.split('\n')[0]).toBe('idle');
	});

	it('prints the usage for an unknown command', async () => {
		expect((await run(['dance'])).out).toContain('usage:');
	});
});
