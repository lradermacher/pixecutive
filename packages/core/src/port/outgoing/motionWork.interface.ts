// motionWork.interface.ts — where one command of the motion chain leaves its result for the next: the cut sprites
// with their plan, and the head track of the used sprites.
import type { FigureName } from '../../domain/Figure/figureName.enum.ts';
import type { HeadTrack } from '../../domain/Figure/headTrack.schema.ts';
import type { Motion } from '../../domain/Figure/motion.enum.ts';
import type { CutFrames } from '../../domain/Figure/cutFrames.interface.ts';

/**
 * The work between the commands. A load rejects with a `FigureException` (invalid job) when the step before has not
 * run; every method rejects with the storage key when its file cannot be used.
 */
export interface IMotionWork {
	saveCut(figure: FigureName, motion: Motion, cut: CutFrames): Promise<void>;
	loadCut(figure: FigureName, motion: Motion): Promise<CutFrames>;
	saveTrack(figure: FigureName, motion: Motion, track: HeadTrack): Promise<void>;
	loadTrack(figure: FigureName, motion: Motion): Promise<HeadTrack>;
}
