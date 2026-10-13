// trackHead.service.ts — the use case "track the head": the tracker places the still's head in every sprite frame,
// and the ear, tracked on its own, must agree with it, or the face parts would slide on the head.
import type { HeadTrack } from '../../domain/Figure/headTrack.schema.ts';
import { headTrackJobSchema } from '../../domain/Figure/headTrackJob.schema.ts';
import type { IHeadTracker } from '../../port/outgoing/headTracker.interface.ts';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import type { TrackHeadCommand } from './trackHeadCommand.ts';

/**
 * Tracks the head through a motion's sprites and checks the track by the ear.
 * @throws {FigureException} the invalid job, head drift or the tracker's own key.
 */
export class TrackHeadService {
	constructor(private readonly tracker: IHeadTracker) {}

	/**
	 * Parses the job, tracks the head and checks every frame's ear offset.
	 * @throws {FigureException} the invalid job key for a wrong job; the head drift key naming each frame whose ear
	 * strayed more than the ear limit; the tracker's own key when it fails.
	 */
	async track(command: TrackHeadCommand): Promise<HeadTrack> {
		const { values, ...job } = command;
		const parsed = headTrackJobSchema.safeParse(job);
		if (!parsed.success) {
			throw new FigureException(
				FigureExceptionKey.InvalidJob,
				parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
			);
		}
		const track = await this.tracker.track(parsed.data, values);
		const strayed = track.earOffset.flatMap((offset, frame) =>
			offset > values.earLimit ? [`frame ${String(frame)}: ${offset.toFixed(2)} px`] : [],
		);
		if (strayed.length > 0) throw new FigureException(FigureExceptionKey.HeadDrift, strayed.join('; '));
		return track;
	}
}
