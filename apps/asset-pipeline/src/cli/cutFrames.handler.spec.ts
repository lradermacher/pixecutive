import {
	ClipMode,
	type CutFrames,
	CutFramesService,
	type CutResult,
	type FigureName,
	type FrameCutConfig,
	type FrameMeasure,
	type FramePlan,
	frameCutConfigSchema,
	type HandPaintJob,
	type HeadTrack,
	type IFrameCutter,
	type IHandPainter,
	type IFrameMeasurer,
	type IMotionWork,
	type Motion,
	PaintHandsService,
} from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import type { FigureSetup } from '../figureConfig.ts';
import { cutFramesHandler } from './cutFrames.handler.ts';

const still = (change: number): FrameMeasure => ({
	top: 1,
	bottom: 9,
	left: 1,
	right: 9,
	legSpread: 4,
	headCenterX: 5,
	change,
});

/** Answers six still frames and keeps the clip it measured. */
class InMemoryFrameMeasurer implements IFrameMeasurer {
	readonly clips: string[] = [];
	measure(clip: string, values: FrameCutConfig): Promise<FrameMeasure[]> {
		this.clips.push(clip);
		return Promise.resolve(Array.from({ length: 6 }, () => still(values.poseChange)));
	}
}

/** Names one sprite per planned frame. */
class InMemoryFrameCutter implements IFrameCutter {
	cut(clip: string, plan: FramePlan, values: FrameCutConfig): Promise<CutResult> {
		return Promise.resolve({
			frames: plan.sprites.map((_, k) => `${clip}-${String(k)}.png`),
			scale: 0.3,
			width: 90,
			height: values.height,
		});
	}
}

/** Keeps what it is given. */
class InMemoryMotionWork implements IMotionWork {
	readonly cuts: [FigureName, Motion, CutFrames][] = [];
	readonly drops: string[] = [];
	dropCut(figure: FigureName, motion: Motion): Promise<void> {
		this.drops.push(`${figure} ${motion}`);
		return Promise.resolve();
	}
	saveCut(figure: FigureName, motion: Motion, cut: CutFrames): Promise<void> {
		this.cuts.push([figure, motion, cut]);
		return Promise.resolve();
	}
	loadCut(): Promise<CutFrames> {
		return Promise.reject(new TypeError('not kept here'));
	}
	saveTrack(): Promise<void> {
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
	range: { first: 1, last: 4 },
	step: 1,
	forward: false,
	trackStill: 'o.png',
};
/** Keeps every job it was handed; fails when told to, as a painter with a missing state drawing does. */
class InMemoryHandPainter implements IHandPainter {
	readonly jobs: HandPaintJob[] = [];
	constructor(private readonly fails = false) {}
	paint(job: HandPaintJob): Promise<void> {
		this.jobs.push(job);
		return this.fails ? Promise.reject(new TypeError('no state drawing')) : Promise.resolve();
	}
}

const setup = {
	rendersDir: '/r',
	sources: '/src',
	figures: { f: { ear: { left: 1, top: 1, right: 9, bottom: 9 }, face: {}, motions: { idle } } },
	cut: frameCutConfigSchema.parse({}),
} as unknown as FigureSetup;

describe('cutFramesHandler', () => {
	it('cuts the clip of the figure motion as the data file says and keeps the cut', async () => {
		const measurer = new InMemoryFrameMeasurer();
		const work = new InMemoryMotionWork();
		const lines = await cutFramesHandler(
			['f', 'idle'],
			setup,
			new CutFramesService(measurer, new InMemoryFrameCutter()),
			work,
			new PaintHandsService(new InMemoryHandPainter()),
		);
		expect(measurer.clips).toEqual(['/r/clips/f-idle.mp4']);
		expect(work.cuts[0]?.[2].plan.sprites.map((s) => s.source)).toEqual([1, 2, 3, 4, 3, 2]);
		expect(lines).toEqual(['cut f idle: 6 sprites of 90x200']);
	});

	it('cuts a motion with a sprite height of its own at that height', async () => {
		const work = new InMemoryMotionWork();
		const sit = { ...setup, figures: { f: { ...setup.figures.f, motions: { idle: { ...idle, height: 183 } } } } };
		await cutFramesHandler(
			['f', 'idle'],
			sit as unknown as FigureSetup,
			new CutFramesService(new InMemoryFrameMeasurer(), new InMemoryFrameCutter()),
			work,
			new PaintHandsService(new InMemoryHandPainter()),
		);
		expect(work.cuts[0]?.[2].plan.height).toBe(183);
	});

	it('paints the motion finger states into its sprites, from the figure sources', async () => {
		const painter = new InMemoryHandPainter();
		const hands = { box: { left: 1, top: 1, right: 9, bottom: 9 }, states: ['f/type-a.png'], ticks: 1 };
		const typing = { ...setup, figures: { f: { ...setup.figures.f, motions: { idle: { ...idle, hands } } } } };
		const lines = await cutFramesHandler(
			['f', 'idle'],
			typing as unknown as FigureSetup,
			new CutFramesService(new InMemoryFrameMeasurer(), new InMemoryFrameCutter()),
			new InMemoryMotionWork(),
			new PaintHandsService(painter),
		);
		expect([painter.jobs[0]?.still, painter.jobs[0]?.states, painter.jobs[0]?.sequence, lines[1]]).toEqual([
			'/src/s.png',
			['/src/f/type-a.png'],
			[null, 0, null, 0, null, 0],
			'painted finger states into 3 sprites',
		]);
	});

	it('forgets the old cut before cutting, so a painter that fails leaves no cut to track or export', async () => {
		const work = new InMemoryMotionWork();
		const hands = { box: { left: 1, top: 1, right: 9, bottom: 9 }, states: ['f/type-a.png'], ticks: 1 };
		const typing = { ...setup, figures: { f: { ...setup.figures.f, motions: { idle: { ...idle, hands } } } } };
		const failure: unknown = await cutFramesHandler(
			['f', 'idle'],
			typing as unknown as FigureSetup,
			new CutFramesService(new InMemoryFrameMeasurer(), new InMemoryFrameCutter()),
			work,
			new PaintHandsService(new InMemoryHandPainter(true)),
		).catch((error: unknown) => error);
		expect([failure instanceof TypeError, work.drops, work.cuts]).toEqual([true, ['f idle'], []]);
	});
});
