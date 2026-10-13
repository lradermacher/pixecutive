import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FigureException, FigureExceptionKey, frameCutConfigSchema, type FramePlan } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { runPythonStep } from '../Python/pythonStep.ts';
import { FrameCutterOpencvAdapter } from './frameCutter-opencv.adapter.ts';

const python = { uv: 'uv', project: resolve(import.meta.dirname, '../../..') };
const script = resolve(import.meta.dirname, 'frames.py');
const values = frameCutConfigSchema.parse({});
/** A real Python start loads OpenCV and decodes a clip; under a full parallel test run that takes longer than 5 s. */
const PYTHON_START_MS = 30_000;

/** A 6-frame clip of a dark standing figure on the light blue background, drawn by OpenCV into a temp folder. */
async function standingClip(): Promise<string> {
	const dir = mkdtempSync(join(tmpdir(), 'cut-clip-'));
	const maker = join(dir, 'make.py');
	writeFileSync(
		maker,
		[
			'import sys, cv2, numpy as np',
			'w = cv2.VideoWriter(sys.argv[1], cv2.VideoWriter_fourcc(*"mp4v"), 24, (160, 160))',
			'for k in range(6):',
			'    f = np.full((160, 160, 3), (226, 212, 186), np.uint8)',
			'    cv2.rectangle(f, (60, 30 + k % 2), (100, 129 + k % 2), (40, 60, 90), -1)',
			'    w.write(f)',
			'w.release()',
		].join('\n'),
	);
	const clip = join(dir, 'idle.mp4');
	await runPythonStep(python, maker, [clip]);
	return clip;
}

/** The width and height a PNG file declares in its header. */
function pngSize(path: string): [number, number] {
	const head = readFileSync(path);
	return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

const plan: FramePlan = {
	sprites: [
		{ source: 0, hold: 1, shiftX: 0, shiftY: 1 },
		{ source: 1, hold: 1, shiftX: 0, shiftY: 0 },
		{ source: 2, hold: 1, shiftX: 0, shiftY: 1 },
	],
	margin: values.margin,
	height: 50,
	driftPerVideoFrame: 0,
};

describe('FrameCutterOpencvAdapter', () => {
	it(
		'writes one sprite per planned frame at the common size, the tallest scaled to the plan height',
		async () => {
			const clip = await standingClip();
			const result = await new FrameCutterOpencvAdapter({ python, script }).cut(clip, plan, values);
			const folder = clip.replace(/\.mp4$/, '');
			expect(result.frames).toEqual(['00.png', '01.png', '02.png'].map((name) => join(folder, name)));
			expect(result.frames.map(pngSize)).toEqual(Array.from({ length: 3 }, () => [result.width, result.height]));
			// the figure is 100 rows tall; with the 2-row top margin the sprite is 102 rows at a scale of 50/100
			expect([result.scale, result.height]).toEqual([0.5, 51]);
		},
		PYTHON_START_MS,
	);

	it(
		'replaces what an earlier cut of the same clip left',
		async () => {
			const clip = await standingClip();
			const folder = clip.replace(/\.mp4$/, '');
			mkdirSync(folder);
			writeFileSync(join(folder, '07.png'), 'stale');
			await new FrameCutterOpencvAdapter({ python, script }).cut(clip, plan, values);
			expect(existsSync(join(folder, '07.png'))).toBe(false);
		},
		PYTHON_START_MS,
	);

	it(
		'names a plan beyond the clip with the frames-failed key',
		async () => {
			const beyond = { ...plan, sprites: [{ source: 40, hold: 1, shiftX: 0, shiftY: 0 }] };
			const failure: unknown = await new FrameCutterOpencvAdapter({ python, script })
				.cut(await standingClip(), beyond, values)
				.catch((error: unknown) => error);
			expect(failure instanceof FigureException && failure.key).toBe(FigureExceptionKey.FramesFailed);
		},
		PYTHON_START_MS,
	);
});
