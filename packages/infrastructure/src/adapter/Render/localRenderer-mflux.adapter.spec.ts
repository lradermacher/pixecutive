import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type RenderJob, RenderException, RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { LocalRendererMfluxAdapter, type MfluxRenderConfig } from './localRenderer-mflux.adapter.ts';

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
	override: (dir: string) => Partial<MfluxRenderConfig> = () => ({}),
): { renderer: LocalRendererMfluxAdapter; dir: string; interrupts: EventEmitter } {
	const dir = mkdtempSync(join(tmpdir(), 'mflux-'));
	const interrupts = new EventEmitter();
	let reads = 0;
	const renderer = new LocalRendererMfluxAdapter({
		rendersDir: dir,
		mflux: fakeMflux(dir, sleepSeconds, exitCode),
		lora: '/hub/lightning.safetensors',
		intervalMs: 50,
		readMemory: (): { pressure: number; swapMb: number } =>
			readings[Math.min(reads++, readings.length - 1)] ?? { pressure: 1, swapMb: 0 },
		clock: { now: (): Date => new Date('2026-10-12T09:30:00.000Z') },
		interrupts,
		...override(dir),
	});
	return { renderer, dir, interrupts };
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
});

describe('LocalRendererMfluxAdapter when something fails', () => {
	it('answers the failed key and logs the exit code when mflux fails', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0', 3);
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('FAILED: exit 3');
	});

	it('names the running render with its current step while it runs', async () => {
		const { renderer } = adapter([{ pressure: 1, swapMb: 100 }], '1');
		const running = renderer.render(job);
		await new Promise((resolve) => setTimeout(resolve, 500));
		expect(renderer.status().running).toBe('figure-s11 1/8');
		await running;
		expect(renderer.status().running).toBeNull();
	});

	it('answers the storage key when the renders folder cannot be made', async () => {
		const { renderer } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, (dir) => {
			writeFileSync(join(dir, 'blocked'), 'a file, not a folder');
			return { rendersDir: join(dir, 'blocked', 'renders') };
		});
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.StorageFailed);
	});

	it('ends the run with the storage key when the renders folder goes away while mflux runs', async () => {
		const { renderer } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, (dir) => {
			const vanishing = join(dir, 'vanishing-mflux');
			writeFileSync(
				vanishing,
				`#!/bin/sh\nrm -rf "${join(dir, 'renders')}"\nprintf ' 1/8 [00:01<00:07, 1.0s/it]\\n'\nsleep 1\n`,
			);
			chmodSync(vanishing, 0o755);
			return { mflux: vanishing, rendersDir: join(dir, 'renders') };
		});
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.StorageFailed);
	});

	it('answers the unreadable memory key before a start without its guard', async () => {
		const { renderer } = adapter([], '0.2', 0, () => ({
			readMemory: (): { pressure: number; swapMb: number } => {
				throw new TypeError('sysctl is missing');
			},
		}));
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.MemoryUnreadable);
	});

	it('never takes an image of an earlier run as the result', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }], '0.2', 0, (folder) => {
			const silent = join(folder, 'silent-mflux');
			writeFileSync(silent, '#!/bin/sh\nexit 0\n');
			chmodSync(silent, 0o755);
			return { mflux: silent };
		});
		writeFileSync(join(dir, 'figure-s11.png'), 'an earlier image');
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Failed);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('FAILED: no image');
	});
});

describe('LocalRendererMfluxAdapter and its lock', () => {
	it('refuses a second render while one runs', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		writeFileSync(join(dir, 'current.lock'), `${String(process.pid)}\tother`);
		expect(await failureKey(renderer.render(job))).toBe(RenderExceptionKey.Busy);
	});

	it('clears a lock whose process is gone and renders', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		const gone = spawnSync('true').pid;
		writeFileSync(join(dir, 'current.lock'), `${String(gone)}\tfigure-s9 3/8`);
		expect(renderer.status().running).toBeNull();
		expect((await renderer.render(job)).name).toBe('figure-s11');
	});

	it('stops on an interrupt, logs why and leaves no lock behind', async () => {
		const { renderer, dir, interrupts } = adapter([{ pressure: 1, swapMb: 100 }], '2');
		const running = failureKey(renderer.render(job));
		await new Promise((resolve) => setTimeout(resolve, 300));
		interrupts.emit('SIGINT');
		expect(await running).toBe(RenderExceptionKey.Interrupted);
		expect(readFileSync(join(dir, 'renders.tsv'), 'utf8')).toContain('ABORT: interrupted');
		expect(existsSync(join(dir, 'current.lock'))).toBe(false);
	});

	it('shows the running render, the memory and the last log rows', async () => {
		const { renderer, dir } = adapter([{ pressure: 1, swapMb: 100 }]);
		await renderer.render(job);
		writeFileSync(join(dir, 'current.lock'), `${String(process.pid)}\tfigure-s12`);
		const status = renderer.status();
		expect([status.running, status.pressure, status.swapMb, status.lastRows.length]).toEqual(['figure-s12', 1, 100, 1]);
	});
});
