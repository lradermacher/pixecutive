// frameMeasurer-opencv.adapter.ts — measures every frame of a clip with OpenCV in the pinned Python environment.
import { type FrameCutConfig, type FrameMeasure, frameMeasureSchema, type IFrameMeasurer } from '@pixecutive/core';
import type { PythonEnvironment } from '../Python/pythonStep.ts';
import { pixelStep } from './pixelStep.ts';

/** The Python environment and the frame script beside this adapter (passed in: a bundled app cannot find it itself). */
export interface FramesScriptConfig {
	readonly python: PythonEnvironment;
	readonly script: string;
}

/**
 * Reports, per video frame, the figure's box, the spread of its feet, its head's centre and the change.
 * @throws {FigureException} the frames-failed key when the clip cannot be read or the step fails.
 */
export class FrameMeasurerOpencvAdapter implements IFrameMeasurer {
	constructor(private readonly config: FramesScriptConfig) {}

	/** One measure per video frame, in order. */
	measure(clip: string, values: FrameCutConfig): Promise<FrameMeasure[]> {
		return pixelStep(
			this.config.python,
			this.config.script,
			['measure', clip, JSON.stringify(values)],
			frameMeasureSchema.array(),
		);
	}
}
