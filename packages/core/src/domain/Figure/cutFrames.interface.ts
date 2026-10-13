// cutFrames.interface.ts — the sprites a clip was cut into, with the plan that chose them.
import type { CutResult } from './cutResult.schema.ts';
import type { FramePlan } from './framePlan.schema.ts';

/** The plan (holds, shifts, drift) and what the cutter wrote. */
export interface CutFrames {
	readonly plan: FramePlan;
	readonly result: CutResult;
}
