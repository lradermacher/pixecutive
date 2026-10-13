import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FigureException, FigureExceptionKey, headTrackConfigSchema } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { runPythonStep } from '../Python/pythonStep.ts';
import { HeadTrackerOpencvAdapter } from './headTracker-opencv.adapter.ts';

const python = { uv: 'uv', project: resolve(import.meta.dirname, '../../..') };
const script = resolve(import.meta.dirname, 'head.py');
const values = headTrackConfigSchema.parse({});
/** A real Python start loads OpenCV; under a full parallel test run that takes longer than 5 s. */
const PYTHON_START_MS = 30_000;
/** Where the sprites move the figure, in sprite pixels per frame. */
const moves = [
	[0, 0],
	[3, 1],
	[6, -2],
];

/**
 * A still of a figure (a round head with a dark ear on a body) on the light blue background, and three sprites: the
 * figure at a third of its size, moved by `moves`. Drawn by OpenCV into a temp folder, so no image enters the repo.
 */
async function figure(): Promise<{ still: string; frames: string[] }> {
	const dir = mkdtempSync(join(tmpdir(), 'head-'));
	const maker = join(dir, 'make.py');
	writeFileSync(
		maker,
		[
			'import sys, json, cv2, numpy as np',
			'from PIL import Image',
			'out, moves = sys.argv[1], json.loads(sys.argv[2])',
			's = np.full((600, 480, 3), (186, 212, 226), np.uint8)',
			'cv2.circle(s, (240, 150), 90, (230, 160, 110), -1)',
			'cv2.circle(s, (200, 140), 18, (120, 60, 40), -1)',
			'cv2.circle(s, (275, 130), 10, (20, 20, 20), -1)',
			'cv2.rectangle(s, (170, 240), (310, 560), (60, 90, 140), -1)',
			'Image.fromarray(s).save(out + "/still.png")',
			'small = cv2.resize(s, None, fx=1/3, fy=1/3, interpolation=cv2.INTER_AREA)',
			'for k, (dx, dy) in enumerate(moves):',
			'    canvas = np.full((220, 180, 3), (186, 212, 226), np.uint8)',
			'    canvas[10 + dy:10 + dy + 200, 10 + dx:10 + dx + 160] = small',
			'    alpha = np.full((220, 180), 255, np.uint8)',
			'    Image.fromarray(np.dstack([canvas, alpha])).save(f"{out}/{k:02d}.png")',
		].join('\n'),
	);
	await runPythonStep(python, maker, [dir, JSON.stringify(moves)]);
	return { still: join(dir, 'still.png'), frames: moves.map((_, k) => join(dir, `0${String(k)}.png`)) };
}

const ear = { left: 180, top: 120, right: 220, bottom: 160 };

describe('HeadTrackerOpencvAdapter', () => {
	it(
		'finds the head where each sprite moved it, at the sprites’ scale, the ear agreeing',
		async () => {
			const { still, frames } = await figure();
			const track = await new HeadTrackerOpencvAdapter({ python, script }).track({ still, frames, ear }, values);
			expect(track.scale).toBeCloseTo(1 / 3, 2);
			const [x0 = 0, y0 = 0] = track.origin[0] ?? [];
			// the first sprite holds the still's (0, 0) at (10, 10)
			expect([Math.round(x0), Math.round(y0)]).toEqual([10, 10]);
			expect(track.origin.map(([x, y]) => [Math.round(x - x0), Math.round(y - y0)])).toEqual(moves);
			expect(Math.max(...track.earOffset)).toBeLessThan(1);
		},
		PYTHON_START_MS,
	);

	it(
		'names a still it cannot read with the track-failed key',
		async () => {
			const { frames } = await figure();
			const failure: unknown = await new HeadTrackerOpencvAdapter({ python, script })
				.track({ still: join(tmpdir(), 'no-still.png'), frames, ear }, values)
				.catch((error: unknown) => error);
			expect(failure instanceof FigureException && failure.key).toBe(FigureExceptionKey.TrackFailed);
		},
		PYTHON_START_MS,
	);
});
