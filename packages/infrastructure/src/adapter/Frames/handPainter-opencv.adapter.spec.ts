import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FigureException, FigureExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { runPythonStep } from '../Python/pythonStep.ts';
import { HandPainterOpencvAdapter } from './handPainter-opencv.adapter.ts';

const python = { uv: 'uv', project: resolve(import.meta.dirname, '../../..') };
const script = resolve(import.meta.dirname, 'frames.py');
/** A real Python start loads OpenCV; under a full parallel test run that takes longer than 5 s. */
const PYTHON_START_MS = 30_000;
const box = { left: 60, top: 40, right: 110, bottom: 70 };

/**
 * A still of a dark figure with a skin-colored hand on the light blue background, a state where the hand has a
 * finger more, and three sprites of the still at half size, the second moved by one pixel; drawn by Python into a
 * temp folder, so no image enters the repo.
 */
async function scene(): Promise<{ still: string; state: string; frames: string[] }> {
	const dir = mkdtempSync(join(tmpdir(), 'hands-'));
	const maker = join(dir, 'make.py');
	writeFileSync(
		maker,
		[
			'import sys, cv2, numpy as np',
			'from PIL import Image',
			'd = sys.argv[1]',
			's = np.full((120, 120, 3), (186, 212, 226), np.uint8)',
			'cv2.rectangle(s, (20, 20), (60, 110), (60, 40, 30), -1)',
			'cv2.rectangle(s, (60, 50), (90, 60), (230, 160, 110), -1)',
			'Image.fromarray(s).save(f"{d}/still.png")',
			't = s.copy(); cv2.rectangle(t, (90, 52), (100, 56), (230, 160, 110), -1); Image.fromarray(t).save(f"{d}/state.png")',
			'small = cv2.resize(s, (60, 60), interpolation=cv2.INTER_AREA)',
			'alpha = (np.abs(small.astype(int) - (186, 212, 226)).sum(2) > 60).astype(np.uint8) * 255',
			'for k, dx in enumerate((0, 1, 0)):',
			'    a = np.zeros((70, 70, 4), np.uint8); a[2:62, 2 + dx:62 + dx, :3] = small; a[2:62, 2 + dx:62 + dx, 3] = alpha',
			'    Image.fromarray(a).save(f"{d}/{k:02d}.png")',
		].join('\n'),
	);
	await runPythonStep(python, maker, [dir]);
	return {
		still: join(dir, 'still.png'),
		state: join(dir, 'state.png'),
		frames: ['00', '01', '02'].map((k) => join(dir, `${k}.png`)),
	};
}

describe('HandPainterOpencvAdapter', () => {
	it(
		'paints the state into the sprites the sequence names and leaves the others as they were',
		async () => {
			const { still, state, frames } = await scene();
			const before = frames.map((frame) => readFileSync(frame));
			await new HandPainterOpencvAdapter({ python, script }).paint({
				frames,
				still,
				scale: 0.5,
				box,
				states: [state],
				sequence: [null, 0, null],
			});
			const after = frames.map((frame) => readFileSync(frame));
			expect([
				after[0]?.equals(before[0] ?? Buffer.alloc(0)),
				after[1]?.equals(before[1] ?? Buffer.alloc(0)),
				after[2]?.equals(before[2] ?? Buffer.alloc(0)),
			]).toEqual([true, false, true]);
		},
		PYTHON_START_MS,
	);

	it(
		'paints the extra finger where the hands moved to in that sprite',
		async () => {
			const { still, state, frames } = await scene();
			await new HandPainterOpencvAdapter({ python, script }).paint({
				frames,
				still,
				scale: 0.5,
				box,
				states: [state],
				sequence: [null, 0, null],
			});
			const probe = join(mkdtempSync(join(tmpdir(), 'hands-probe-')), 'probe.py');
			// the extra finger lies at still x 90..100, y 52..56: in sprite 1 at x 2 + 1 + 45..50, y 2 + 26..28
			writeFileSync(
				probe,
				[
					'import sys, numpy as np',
					'from PIL import Image',
					'a = np.asarray(Image.open(sys.argv[1]))',
					'print(int(a[29, 50, 3]), int(a[29, 54, 3]))',
				].join('\n'),
			);
			const answer = await runPythonStep(python, probe, [frames[1] ?? '']);
			expect(answer.stdout.trim()).toMatch(/^2\d\d 0$/);
		},
		PYTHON_START_MS,
	);

	it(
		'names a state that is not the size of the still with the frames-failed key',
		async () => {
			const { still, frames } = await scene();
			const failure: unknown = await new HandPainterOpencvAdapter({ python, script })
				.paint({ frames, still, scale: 0.5, box, states: [frames[0] ?? ''], sequence: [0, null, null] })
				.catch((error: unknown) => error);
			expect(failure instanceof FigureException && [failure.key, failure.detail]).toEqual([
				FigureExceptionKey.FramesFailed,
				'exit 2: a state drawing is not the size of the still',
			]);
		},
		PYTHON_START_MS,
	);
});
