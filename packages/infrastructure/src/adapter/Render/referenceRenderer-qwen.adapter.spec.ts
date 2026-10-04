import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QwenReferenceRendererAdapter } from './referenceRenderer-qwen.adapter.ts';

/** A fake model: prints two progress steps like mflux, waits, then writes the image it was handed last. */
const fakeModel = ['sh', '-c', 'printf " 1/8 [00:01<00:07, 1.0s/it]\\n"; sleep "$0"; printf x > "$4"'];

function adapter(
	readings: readonly { pressure: number; swapMb: number }[],
	sleepSeconds = '0.2',
): { renderer: QwenReferenceRendererAdapter; dir: string } {
	const dir = mkdtempSync(join(tmpdir(), 'qwen-'));
	let reads = 0;
	const renderer = new QwenReferenceRendererAdapter({
		outputDir: dir,
		command: [...fakeModel, sleepSeconds],
		model: 'fake',
		steps: 8,
		width: 64,
		height: 32,
		intervalMs: 50,
		readMemory: (): { pressure: number; swapMb: number } =>
			readings[Math.min(reads++, readings.length - 1)] ?? { pressure: 1, swapMb: 0 },
		now: (): Date => new Date('2026-10-04T20:30:00.000Z'),
	});
	return { renderer, dir };
}

describe('QwenReferenceRendererAdapter', () => {
	it('returns the image and logs a done row with every column', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		const outcome = await renderer.render('in.png', 'a prompt', 11);
		expect(outcome).toEqual({ image: join(dir, 'ref-11.png'), problem: '' });
		const row = readFileSync(join(dir, 'renders.tsv'), 'utf8').trim().split('\t');
		expect(row).toHaveLength(11);
		expect(row[10]).toBe('done');
	});

	it('refuses a start at warning pressure without rendering', async () => {
		const { renderer, dir } = adapter([{ pressure: 2, swapMb: 100 }]);
		expect(await renderer.render('in.png', 'p', 11)).toEqual({
			image: null,
			problem: 'memory pressure level 2 before the start',
		});
		expect(() => readFileSync(join(dir, 'renders.tsv'))).toThrow();
	});

	it('aborts at critical pressure while running and logs why', async () => {
		const { renderer, dir } = adapter(
			[
				{ pressure: 1, swapMb: 100 },
				{ pressure: 4, swapMb: 100 },
			],
			'2',
		);
		expect((await renderer.render('in.png', 'p', 11)).problem).toBe('ABORT: memory pressure level 4');
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('ABORT: memory pressure level 4');
	});

	it('aborts when swap grows past the limit', async () => {
		const { renderer } = adapter(
			[
				{ pressure: 1, swapMb: 100 },
				{ pressure: 1, swapMb: 17000 },
			],
			'2',
		);
		expect((await renderer.render('in.png', 'p', 11)).problem).toBe('ABORT: swap +16900 MB over the 16384 MB limit');
	});

	it('refuses a second render while one runs', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		writeFileSync(join(dir, 'current.lock'), 'other');
		expect((await renderer.render('in.png', 'p', 11)).problem).toBe('a render is running (other)');
	});
});
