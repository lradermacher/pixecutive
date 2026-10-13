// frameCutter-opencv.adapter.ts — applies a frame plan with OpenCV in the pinned Python environment: the sprites of a
// clip go into a folder named after it, replacing what an earlier cut left there.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import {
	type CutResult,
	cutResultSchema,
	FigureException,
	FigureExceptionKey,
	type FrameCutConfig,
	type FramePlan,
	type IFrameCutter,
} from '@pixecutive/core';
import type { FramesScriptConfig } from './frameMeasurer-opencv.adapter.ts';
import { pixelStep } from './pixelStep.ts';

/**
 * Writes one sprite per planned frame into `<clip without .mp4>/NN.png`.
 * @throws {FigureException} the frames-failed key when the step fails, the storage key when the old sprites cannot go.
 */
export class FrameCutterOpencvAdapter implements IFrameCutter {
	constructor(private readonly config: FramesScriptConfig) {}

	/** Cuts the planned frames; sprites of an earlier cut of the same clip are removed first. */
	cut(clip: string, plan: FramePlan, values: FrameCutConfig): Promise<CutResult> {
		const folder = join(clip.replace(/\.mp4$/, ''));
		try {
			rmSync(folder, { recursive: true, force: true });
		} catch (failure) {
			throw new FigureException(FigureExceptionKey.StorageFailed, `clear ${folder}: ${(failure as Error).message}`);
		}
		return pixelStep(
			this.config.python,
			this.config.script,
			['cut', clip, JSON.stringify(plan), JSON.stringify(values), folder],
			cutResultSchema,
		);
	}
}
