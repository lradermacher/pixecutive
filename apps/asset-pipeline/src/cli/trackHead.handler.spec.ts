import {
	ClipMode,
	type CutFrames,
	FigureException,
	FigureExceptionKey,
	type FigureName,
	type HeadTrack,
	type HeadTrackConfig,
	type HeadTrackJob,
	headTrackConfigSchema,
	type IHeadTracker,
	type IMotionWork,
	type Motion,
	TrackHeadService,
} from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import type { FigureSetup } from '../figureConfig.ts';
import { trackHeadHandler } from './trackHead.handler.ts';

/** Keeps every job and its values and answers one origin per frame, the ear within `ear` px. */
class InMemoryHeadTracker implements IHeadTracker {
	readonly jobs: HeadTrackJob[] = [];
	readonly values: HeadTrackConfig[] = [];
	constructor(private readonly ear: number) {}
	track(job: HeadTrackJob, values: HeadTrackConfig): Promise<HeadTrack> {
		this.jobs.push(job);
		this.values.push(values);
		return Promise.resolve({
			scale: 0.345,
			origin: job.frames.map((): [number, number] => [-48, -36]),
			earOffset: job.frames.map(() => this.ear),
		});
	}
}

/** Holds one cut of five sprites and keeps the tracks it is given. */
class InMemoryMotionWork implements IMotionWork {
	readonly tracks: [FigureName, Motion, HeadTrack][] = [];
	dropCut(): Promise<void> {
		return Promise.resolve();
	}
	saveCut(): Promise<void> {
		return Promise.resolve();
	}
	loadCut(figure: FigureName, motion: Motion): Promise<CutFrames> {
		const frames = [0, 1, 2, 3, 4].map((k) => `/r/clips/${figure}-${motion}/0${String(k)}.png`);
		const plan = { sprites: [], margin: { top: 0, bottom: 0, left: 0, right: 0 }, height: 200, driftPerVideoFrame: 0 };
		return Promise.resolve({ plan, result: { frames, scale: 0.3, width: 90, height: 201 } });
	}
	saveTrack(figure: FigureName, motion: Motion, track: HeadTrack): Promise<void> {
		this.tracks.push([figure, motion, track]);
		return Promise.resolve();
	}
	loadTrack(): Promise<HeadTrack> {
		return Promise.reject(new TypeError('not kept here'));
	}
}

const idle = {
	mode: ClipMode.Loop,
	frames: 49,
	endStrength: 0.8,
	prompt: 'p.txt',
	still: 's.png',
	use: { first: 1, last: 3 },
	trackStill: 'm/open.png',
};
const setup = {
	sources: '/src',
	figures: { m: { ear: { left: 184, top: 215, right: 216, bottom: 260 }, face: {}, motions: { idle } } },
	track: headTrackConfigSchema.parse({}),
} as unknown as FigureSetup;

describe('trackHeadHandler', () => {
	it('tracks the used sprites against the motion still with the figure ear and keeps the track', async () => {
		const tracker = new InMemoryHeadTracker(0.5);
		const work = new InMemoryMotionWork();
		const lines = await trackHeadHandler(['m', 'idle'], setup, new TrackHeadService(tracker), work);
		expect(tracker.jobs).toEqual([
			{
				still: '/src/m/open.png',
				frames: ['/r/clips/m-idle/01.png', '/r/clips/m-idle/02.png', '/r/clips/m-idle/03.png'],
				ear: { left: 184, top: 215, right: 216, bottom: 260 },
			},
		]);
		expect([tracker.values, work.tracks.length]).toEqual([[setup.track], 1]);
		expect(lines).toEqual(['tracked m idle: 3 frames at scale 0.3450, ear within 0.50 px']);
	});

	it('keeps no track when the ear strays', async () => {
		const work = new InMemoryMotionWork();
		const failure: unknown = await trackHeadHandler(
			['m', 'idle'],
			setup,
			new TrackHeadService(new InMemoryHeadTracker(3)),
			work,
		).catch((error: unknown) => error);
		expect([failure instanceof FigureException && failure.key, work.tracks]).toEqual([
			FigureExceptionKey.HeadDrift,
			[],
		]);
	});
});
