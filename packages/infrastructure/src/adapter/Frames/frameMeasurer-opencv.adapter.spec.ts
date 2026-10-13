import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FigureException, FigureExceptionKey, frameCutConfigSchema } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { runPythonStep } from '../Python/pythonStep.ts';
import { FrameMeasurerOpencvAdapter } from './frameMeasurer-opencv.adapter.ts';

const python = { uv: 'uv', project: resolve(import.meta.dirname, '../../..') };
const script = resolve(import.meta.dirname, 'frames.py');
const values = frameCutConfigSchema.parse({});
/** A real Python start loads OpenCV and decodes a clip; under a full parallel test run that takes longer than 5 s. */
const PYTHON_START_MS = 30_000;

/**
 * A 12-frame clip on the light blue background: a dark figure that walks 2 px right per frame, its feet spreading
 * and closing again. Drawn by OpenCV into a temp folder, so no video enters the repo.
 */
async function walkingClip(): Promise<string> {
	const dir = mkdtempSync(join(tmpdir(), 'frames-clip-'));
	const maker = join(dir, 'make.py');
	writeFileSync(
		maker,
		[
			'import sys, cv2, numpy as np',
			'w = cv2.VideoWriter(sys.argv[1], cv2.VideoWriter_fourcc(*"mp4v"), 24, (160, 160))',
			'for k in range(12):',
			'    f = np.full((160, 160, 3), (226, 212, 186), np.uint8)',
			'    x = 40 + 2 * k',
			'    cv2.rectangle(f, (x, 30), (x + 40, 120), (40, 60, 90), -1)',
			'    s = (k % 4) * 6',
			'    cv2.rectangle(f, (x - s, 120), (x + 40 + s, 140), (40, 60, 90), -1)',
			'    w.write(f)',
			'w.release()',
		].join('\n'),
	);
	const clip = join(dir, 'walk.mp4');
	await runPythonStep(python, maker, [clip]);
	return clip;
}

describe('FrameMeasurerOpencvAdapter', () => {
	it(
		'measures every frame: the box, the spreading feet and the head moving with the figure',
		async () => {
			const measures = await new FrameMeasurerOpencvAdapter({ python, script }).measure(await walkingClip(), values);
			expect(measures).toHaveLength(12);
			const [first, second, , fourth] = measures.map((m) => m);
			if (!first || !second || !fourth) throw new TypeError('fewer than four measures');
			expect([first.top, first.bottom]).toEqual([30, 140]);
			expect(second.headCenterX - first.headCenterX).toBeCloseTo(2, 0);
			expect(fourth.legSpread - first.legSpread).toBeGreaterThan(30);
			expect([first.change, second.change > 0]).toEqual([0, true]);
		},
		PYTHON_START_MS,
	);

	it(
		'names a clip it cannot read with the frames-failed key',
		async () => {
			const failure: unknown = await new FrameMeasurerOpencvAdapter({ python, script })
				.measure(join(tmpdir(), 'no-such-clip.mp4'), values)
				.catch((error: unknown) => error);
			expect(failure instanceof FigureException && [failure.key, failure.detail.split(':')[0]]).toEqual([
				FigureExceptionKey.FramesFailed,
				'exit 2',
			]);
		},
		PYTHON_START_MS,
	);
});
