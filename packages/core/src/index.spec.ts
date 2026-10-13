import { describe, expect, it } from 'vitest';
import {
	ClipMode,
	clipConfigSchema,
	clipJobSchema,
	cutResultSchema,
	FigureName,
	frameCutConfigSchema,
	headTrackJobSchema,
	Motion,
	packageName,
	PlanFramesService,
} from './index.ts';

describe('@pixecutive/core', () => {
	it('exposes its workspace name through its entry', () => {
		expect(packageName).toBe('@pixecutive/core');
	});

	it('exposes the figure domain through its entry', () => {
		const job = clipJobSchema.parse({
			figure: FigureName.F,
			motion: Motion.Walk,
			mode: ClipMode.Cycle,
			still: 'f.png',
			promptFile: 'walk.txt',
			frames: 73,
			endStrength: 1,
		});
		expect([job.figure, job.motion, job.mode]).toEqual(['f', 'walk', 'cycle']);
	});

	it('exposes the frame planning through its entry', () => {
		const frame = { top: 0, bottom: 9, left: 0, right: 9, legSpread: 1, headCenterX: 4, change: 0 };
		const plan = new PlanFramesService().planLoop(
			[frame],
			{ first: 0, last: 0 },
			1,
			true,
			frameCutConfigSchema.parse({}),
		);
		expect(plan.sprites).toEqual([{ source: 0, hold: 1, shiftX: 0, shiftY: 0 }]);
	});

	it('exposes the head-tracking job through its entry', () => {
		const ear = { left: 1, top: 1, right: 9, bottom: 9 };
		expect(headTrackJobSchema.safeParse({ still: 'm.png', frames: ['00.png'], ear }).success).toBe(true);
	});

	it('exposes the clip settings through its entry', () => {
		const config = clipConfigSchema.parse({ rendersDir: '/r', ltxProject: '/ltx', model: '/m' });
		expect([config.frameRate, config.size]).toEqual([24, 768]);
	});

	it('exposes the cut result through its entry', () => {
		expect(cutResultSchema.safeParse({ frames: ['00.png'], scale: 1, width: 1, height: 1 }).success).toBe(true);
	});
});
