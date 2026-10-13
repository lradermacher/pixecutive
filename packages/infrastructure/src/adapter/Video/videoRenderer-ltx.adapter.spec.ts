import { EventEmitter } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type ClipJob, ClipMode, FigureException, FigureExceptionKey, FigureName, Motion } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import type { MemoryReading } from '../Guard/memoryReading.interface.ts';
import { VideoRendererLtxAdapter } from './videoRenderer-ltx.adapter.ts';

/** A still and a prompt that exist, as a clip checks before it starts the model. */
const inputs = mkdtempSync(join(tmpdir(), 'clip-inputs-'));
const still = join(inputs, 'm.png');
const promptFile = join(inputs, 'idle.txt');
writeFileSync(still, 'a still');
writeFileSync(promptFile, 'stands and waits calmly\n');

const job: ClipJob = {
	figure: FigureName.M,
	motion: Motion.Idle,
	mode: ClipMode.Loop,
	still,
	promptFile,
	frames: 49,
	endStrength: 0.8,
};

/** A uv that records its arguments, reports two denoising steps like ltx-2-mlx and writes the clip after `-o`. */
function fakeUv(dir: string, body = 'printf x > "$out"'): string {
	const path = join(dir, 'uv');
	writeFileSync(
		path,
		[
			'#!/bin/sh',
			`printf '%s\\n' "$@" > "${join(dir, 'args.txt')}"`,
			'out=""; while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done',
			"printf 'Denoising:  50%%|#    | 1/2 [00:07<00:07, 7.5s/it]\\rDenoising: 100%%|#####| 2/2 [00:15<00:00, 7.5s/it]\\n' >&2",
			body,
		].join('\n'),
	);
	chmodSync(path, 0o755);
	return path;
}

/** An adapter on a throwaway renders folder with the memory readings given in turn (the last one repeats). */
function adapter(
	readings: MemoryReading[] = [{ pressure: 1, swapMb: 0 }],
	body?: string,
): { renderer: VideoRendererLtxAdapter; dir: string } {
	const dir = mkdtempSync(join(tmpdir(), 'clips-'));
	let reads = 0;
	const renderer = new VideoRendererLtxAdapter({
		rendersDir: dir,
		uv: fakeUv(dir, body),
		ltxProject: '/deps/ltx-2-mlx',
		model: '/hub/ltx-2.3-mlx-q8',
		promptSuffix: ', three-quarter view',
		frameRate: 24,
		size: 768,
		intervalMs: 20,
		readMemory: (): MemoryReading => readings[Math.min(reads++, readings.length - 1)] ?? { pressure: 1, swapMb: 0 },
		interrupts: new EventEmitter(),
	});
	return { renderer, dir };
}

async function failureKey(render: Promise<unknown>): Promise<FigureExceptionKey | null> {
	const failure: unknown = await render.then(
		() => null,
		(error: unknown) => error,
	);
	return failure instanceof FigureException ? failure.key : null;
}

describe('VideoRendererLtxAdapter', () => {
	it('renders the clip into place and leaves nothing unfinished beside it', async () => {
		const { renderer, dir } = adapter();
		const clip = join(dir, 'clips', 'm-idle.mp4');
		expect(await renderer.render(job)).toEqual({ clip });
		expect([readFileSync(clip, 'utf8'), existsSync(join(dir, 'clips', 'm-idle.rendering.mp4'))]).toEqual(['x', false]);
		expect(existsSync(join(dir, 'current.lock'))).toBe(false);
	});

	it('hands the model its prompt with the shared suffix and anchors a loop on the same still at both ends', async () => {
		const { renderer, dir } = adapter();
		await renderer.render(job);
		const args = readFileSync(join(dir, 'args.txt'), 'utf8').trim().split('\n');
		expect(args.slice(0, 5)).toEqual(['run', '--project', '/deps/ltx-2-mlx', 'ltx-2-mlx', 'generate']);
		expect(args[args.indexOf('--prompt') + 1]).toBe('stands and waits calmly, three-quarter view');
		expect(args.join(' ')).toContain(`--image ${still} 0 1.0 --image ${still} 48 0.8 -f 49 --frame-rate 24`);
	});

	it('anchors only the first frame of a cycle', async () => {
		const { renderer, dir } = adapter();
		await renderer.render({ ...job, mode: ClipMode.Cycle, motion: Motion.Walk, frames: 73 });
		const args = readFileSync(join(dir, 'args.txt'), 'utf8');
		expect(args.split('--image').length - 1).toBe(1);
	});

	it('refuses a missing still before the model starts', async () => {
		const { renderer, dir } = adapter();
		expect(await failureKey(renderer.render({ ...job, still: join(inputs, 'gone.png') }))).toBe(
			FigureExceptionKey.InvalidJob,
		);
		expect(existsSync(join(dir, 'args.txt'))).toBe(false);
	});

	it('refuses a second job while the shared lock is held', async () => {
		const { renderer, dir } = adapter();
		writeFileSync(join(dir, 'current.lock'), `${String(process.pid)}\tfigure-s11`);
		expect(await failureKey(renderer.render(job))).toBe(FigureExceptionKey.Busy);
	});

	it('refuses the start under memory pressure', async () => {
		const { renderer } = adapter([{ pressure: 2, swapMb: 0 }]);
		expect(await failureKey(renderer.render(job))).toBe(FigureExceptionKey.MemoryPressure);
	});

	it('stops the model at critical pressure and keeps no clip', async () => {
		const { renderer, dir } = adapter(
			[
				{ pressure: 1, swapMb: 0 },
				{ pressure: 4, swapMb: 0 },
			],
			'exec sleep 5',
		);
		expect(await failureKey(renderer.render(job))).toBe(FigureExceptionKey.Aborted);
		expect(existsSync(join(dir, 'clips', 'm-idle.mp4'))).toBe(false);
	});

	it('names a failed model with the clip failed key and its last words', async () => {
		const { renderer } = adapter(undefined, 'echo "ValueError: no weights" >&2; exit 1');
		const failure: unknown = await renderer.render(job).catch((error: unknown) => error);
		expect(failure instanceof FigureException && [failure.key, failure.detail]).toEqual([
			FigureExceptionKey.ClipFailed,
			'exit 1: ValueError: no weights',
		]);
	});

	it('names a model that ended without a clip with the clip failed key', async () => {
		const { renderer } = adapter(undefined, 'true');
		expect(await failureKey(renderer.render(job))).toBe(FigureExceptionKey.ClipFailed);
	});

	it('names a renders folder it cannot use with the storage key', async () => {
		const { renderer, dir } = adapter();
		mkdirSync(join(dir, 'current.lock'));
		expect(await failureKey(renderer.render(job))).toBe(FigureExceptionKey.StorageFailed);
	});
});
