// handPainter-opencv.adapter.ts — paints drawn finger states into a motion's sprites with OpenCV in the pinned
// Python environment (the frame step's `hands`): it finds the hands in each sprite and paints there what changed.
import { FigureExceptionKey, type HandPaintJob, type IHandPainter } from '@pixecutive/core';
import { type AnswerSchema, pixelStep } from '../Python/pixelStep.ts';
import type { PythonScriptConfig } from '../Python/pythonStep.ts';

/** The step's answer: where it found the hands in each sprite. */
const positions: AnswerSchema<number[][]> = {
	safeParse: (data) => {
		const list = (data as { positions?: unknown } | null)?.positions;
		return Array.isArray(list) && list.every((p) => Array.isArray(p) && p.length === 2)
			? { success: true, data: list as number[][] }
			: { success: false, error: { issues: [{ path: ['positions'], message: 'the hands per sprite' }] } };
	},
};

/**
 * Paints finger states into sprites in place.
 * @throws {FigureException} the frames-failed key when the step fails or a state is not the still's size.
 */
export class HandPainterOpencvAdapter implements IHandPainter {
	constructor(private readonly config: PythonScriptConfig) {}

	/** Paints each sprite's state where the job's sequence names one. */
	async paint(job: HandPaintJob): Promise<void> {
		await pixelStep(
			this.config.python,
			this.config.script,
			['hands', JSON.stringify(job)],
			positions,
			FigureExceptionKey.FramesFailed,
		);
	}
}
