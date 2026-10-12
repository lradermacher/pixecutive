import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runPipeline } from './runPipeline.ts';

/** Runs one command with a throwaway renders folder and collects what it writes. */
function run(
	argv: readonly string[],
	rendersDir = mkdtempSync(join(tmpdir(), 'pipeline-')),
): { code: number; out: string; err: string } {
	let out = '';
	let err = '';
	const env = { PIX_RENDERS_DIR: rendersDir };
	const code = runPipeline(argv, env, { write: (text) => (out += text) }, { write: (text) => (err += text) });
	return { code, out, err };
}

describe('runPipeline', () => {
	it('shows the status of an idle guard', () => {
		expect(run(['status', 'base-m']).out.split('\n')[0]).toBe('idle');
	});

	it('shows the render running in the figure folder', () => {
		const rendersDir = mkdtempSync(join(tmpdir(), 'pipeline-'));
		mkdirSync(join(rendersDir, 'base-m'));
		writeFileSync(join(rendersDir, 'base-m', 'current.lock'), 'ref-11');
		expect(run(['status', 'base-m'], rendersDir).out.split('\n')[0]).toBe('running ref-11');
	});

	it('prints the usage for an unknown command', () => {
		expect(run(['dance']).out).toContain('usage:');
	});
});
