// trackHead.service.ts — the use case "track the head": the tracker places the still's head in every sprite frame,
// and the ear, tracked on its own, must agree with it, or the face parts would slide on the head.
import type { HeadTrack } from '../../domain/Figure/headTrack.schema.ts';
import type { HeadTrackConfig } from '../../domain/Figure/headTrackConfig.schema.ts';
import { headTrackJobSchema } from '../../domain/Figure/headTrackJob.schema.ts';
import type { IHeadTracker } from '../../port/outgoing/headTracker.interface.ts';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';

/** The ear may stray from the head by at most this many sprite pixels in any frame. */
const EAR_LIMIT_PX = 1;

/**
 * Tracks the head through a motion's sprites and checks the track by the ear.
 * @throws {FigureException} the invalid job, head drift or the tracker's own key.
 */
export class TrackHeadService {
	constructor(private readonly tracker: IHeadTracker) {}

	/**
	 * Parses the job, tracks the head and checks every frame's ear offset.
	 * @throws {FigureException} the invalid job key for a wrong job; the head drift key naming each frame whose ear
	 * strayed more than 1 px; the tracker's own key when it fails.
	 */
	async track(job: unknown, values: HeadTrackConfig): Promise<HeadTrack> {
		const parsed = headTrackJobSchema.safeParse(job);
		if (!parsed.success) {
			throw new FigureException(
				FigureExceptionKey.InvalidJob,
				parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
			);
		}
		const track = await this.tracker.track(parsed.data, values);
		const strayed = track.earOffset.flatMap((offset, frame) =>
			offset > EAR_LIMIT_PX ? [`frame ${String(frame)}: ${offset.toFixed(2)} px`] : [],
		);
		if (strayed.length > 0) throw new FigureException(FigureExceptionKey.HeadDrift, strayed.join('; '));
		return track;
	}
}
