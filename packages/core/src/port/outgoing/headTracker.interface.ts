// headTracker.interface.ts — finds where the still's head lands in each sprite frame, and checks it by the ear.
import type { HeadTrack } from '../../domain/Figure/headTrack.schema.ts';
import type { HeadTrackJob } from '../../domain/Figure/headTrackJob.schema.ts';

/** The head tracker: one origin and one ear offset per frame; rejects with a `FigureException` (track failed). */
export interface IHeadTracker {
	track(job: HeadTrackJob): Promise<HeadTrack>;
}
