import { describe, expect, it } from 'vitest';
import type { HeadTrack } from '../../domain/Figure/headTrack.schema.ts';
import type { HeadTrackJob } from '../../domain/Figure/headTrackJob.schema.ts';
import type { IHeadTracker } from '../../port/outgoing/headTracker.interface.ts';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import { TrackHeadService } from './trackHead.service.ts';

/** Answers one origin per frame and the ear offsets it was built with; keeps the jobs it was handed. */
class InMemoryHeadTracker implements IHeadTracker {
	readonly jobs: HeadTrackJob[] = [];
	constructor(private readonly earOffset: number[]) {}

	track(job: HeadTrackJob): Promise<HeadTrack> {
		this.jobs.push(job);
		return Promise.resolve({
			scale: 0.345,
			origin: job.frames.map((_, k) => [k, 2] as [number, number]),
			earOffset: this.earOffset,
		});
	}
}

const job = {
	still: 'm_open.png',
	frames: ['00.png', '01.png'],
	ear: { left: 184, top: 215, right: 216, bottom: 260 },
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> => promise.catch((error: unknown) => error);

describe('TrackHeadService', () => {
	it('answers the track when every ear stays within 1 px of the head', async () => {
		const track = await new TrackHeadService(new InMemoryHeadTracker([0.4, 1])).track(job);
		expect(track.origin).toEqual([
			[0, 2],
			[1, 2],
		]);
	});

	it('names every frame whose ear strayed more than 1 px with the head drift key', async () => {
		const failure = await failureOf(new TrackHeadService(new InMemoryHeadTracker([0.4, 1.01])).track(job));
		expect(failure instanceof FigureException && [failure.key, failure.detail]).toEqual([
			FigureExceptionKey.HeadDrift,
			'frame 1: 1.01 px',
		]);
	});

	it('refuses a wrong job with the invalid job key and never starts the tracker', async () => {
		const tracker = new InMemoryHeadTracker([0]);
		const failure = await failureOf(new TrackHeadService(tracker).track({ ...job, frames: [] }));
		expect([failure instanceof FigureException && failure.key, tracker.jobs]).toEqual([
			FigureExceptionKey.InvalidJob,
			[],
		]);
	});
});
