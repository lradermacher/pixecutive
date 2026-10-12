import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type RenderJob, RenderException, RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { LocalRendererMfluxAdapter } from './localRenderer-mflux.adapter.ts';

const job: RenderJob = { promptFile: 'figure.txt', inputImage: 'figure.png', seed: 11, width: 1024, height: 768 };

/**
 * A fake mflux: keeps its arguments, prints a progress step like mflux, waits, then writes the image named after
 * `--output`, or exits with `exitCode` without one.
 */
function fakeMflux(dir: string, sleepSeconds: string, exitCode = 0): string {
	const path = join(dir, 'mflux');
	writeFileSync(
		path,
		[
			'#!/bin/sh',
			`printf '%s\\n' "$@" > "${join(dir, 'args.txt')}"`,
			'out=""; while [ $# -gt 0 ]; do [ "$1" = "--output" ] && out="$2"; shift; done',
			`printf ' 1/8 [00:01<00:07, 1.0s/it]\\n'; sleep ${sleepSeconds}`,
			exitCode === 0 ? 'printf x > "$out"' : `exit ${String(exitCode)}`,
		].join('\n'),
	);
	chmodSync(path, 0o755);
	return path;
}

function adapter(
	readings: readonly { pressure: number; swapMb: number }[],
	sleepSeconds = '0.2',
	exitCode = 0,
): { renderer: LocalRendererMfluxAdapter; dir: string } {
	const dir = mkdtempSync(join(tmpdir(), 'mflux-'));
	let reads = 0;
	const renderer = new LocalRendererMfluxAdapter({
		rendersDir: dir,
		mflux: fakeMflux(dir, sleepSeconds, exitCode),
		lora: '/hub/lightning.safetensors',
		intervalMs: 50,
		readMemory: (): { pressure: number; swapMb: number } =>
			readings[Math.min(reads++, readings.length - 1)] ?? { pressure: 1, swapMb: 0 },
		clock: { now: (): Date => new Date('2026-10-12T09:30:00.000Z') },
	});
	return { renderer, dir };
}

/** The key of the `RenderException` a render rejects with. */
async function failureKey(render: Promise<unknown>): Promise<RenderExceptionKey | null> {
	const failure: unknown = await render.then(
		() => null,
		(error: unknown) => error,
	);
	return failure instanceof RenderException ? failure.key : null;
}

describe('LocalRendererMfluxAdapter', () => {
	it('answers the image and logs a done row with every column', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		expect(await renderer.render(job)).toEqual({ name: 'figure-s11', image: join(dir, 'figure-s11.png') });
		const row = readFileSync(join(dir, 'renders.tsv'), 'utf8').trim().split('\t');
		expect(row).toHaveLength(11);
		expect([row[0], row[4], row[10]]).toEqual(['2026-10-12 09:30', '1024x768', 'done']);
	});

	it('hands mflux the job, the LoRA and the output path', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		await renderer.render(job);
		const args = readFileSync(join(dir, 'args.txt'), 'utf8').split('\n');
		expect(args.slice(args.indexOf('--seed'), args.indexOf('--seed') + 4)).toEqual([
			'--seed',
			'11',
			'--output',
			join(dir, 'figure-s11.png'),
		]);
		expect(args[args.indexOf('--lora-paths') + 1]).toBe('/hub/lightning.safetensors');
	});

	it('refuses a start at warning pressure without rendering', async () => {
		const { renderer, dir } = adapter([{ pressure: 2, swapMb: 100 }]);
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.MemoryPressure);
		expect(() => readFileSync(join(dir, 'renders.tsv'))).toThrow();
	});

	it('aborts at critical pressure while running and logs why', async () => {
		const readings = [
			{ pressure: 1, swapMb: 100 },
			{ pressure: 4, swapMb: 100 },
		];
		const { renderer, dir } = adapter(readings, '2');
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Aborted);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('ABORT: memory pressure level 4');
	});

	it('aborts when swap grows past the limit', async () => {
		const readings = [
			{ pressure: 1, swapMb: 100 },
			{ pressure: 1, swapMb: 17000 },
		];
		const { renderer, dir } = adapter(readings, '2');
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Aborted);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('ABORT: swap +16900 MB over the 16384 MB limit');
	});

	it('answers the failed key and logs the exit code when mflux fails', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0', 3);
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('FAILED: exit 3');
	});

	it('refuses a second render while one runs', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		writeFileSync(join(dir, 'current.lock'), 'other');
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Busy);
	});

	it('shows the running render, the memory and the last log rows', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		await renderer.render(job);
		writeFileSync(join(dir, 'current.lock'), 'figure-s12');
		const status = renderer.status();
		expect([status.running, status.pressure, status.swapMb, status.lastRows.length]).toEqual(['figure-s12', 1, 100, 1]);
	});
});
