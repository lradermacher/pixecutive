// headTracker-opencv.adapter.ts — tracks the still's head through a motion's sprites with OpenCV template matching in
// the pinned Python environment, and the ear beside it as the independent check.
import {
	FigureExceptionKey,
	type HeadTrack,
	type HeadTrackConfig,
	type HeadTrackJob,
	headTrackSchema,
	type IHeadTracker,
} from '@pixecutive/core';
import { pixelStep } from '../Python/pixelStep.ts';
import type { PythonScriptConfig } from '../Python/pythonStep.ts';

/**
 * Reports the scale, the head origin per frame and how far the ear strayed from the head in each frame.
 * @throws {FigureException} the track-failed key when an image cannot be read or the step fails.
 */
export class HeadTrackerOpencvAdapter implements IHeadTracker {
	constructor(private readonly config: PythonScriptConfig) {}

	/** One origin and one ear offset per frame, in the frames' order. */
	track(job: HeadTrackJob, values: HeadTrackConfig): Promise<HeadTrack> {
		return pixelStep(
			this.config.python,
			this.config.script,
			['track', job.still, JSON.stringify(job.frames), JSON.stringify(job.ear), JSON.stringify(values)],
			headTrackSchema,
			FigureExceptionKey.TrackFailed,
		);
	}
}
