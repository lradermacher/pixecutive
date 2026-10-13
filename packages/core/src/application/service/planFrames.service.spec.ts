import { describe, expect, it } from 'vitest';
import { frameCutConfigSchema } from '../../domain/Figure/frameCutConfig.schema.ts';
import { type FrameMeasure, frameMeasureSchema } from '../../domain/Figure/frameMeasure.schema.ts';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import femaleWalk from './planFrames.f-walk.fixture.json' with { type: 'json' };
import maleWalk from './planFrames.m-walk.fixture.json' with { type: 'json' };
import { PlanFramesService } from './planFrames.service.ts';

// The fixtures are the measures of the shipped walk clips of M and F, taken with the proof of concept's own code; the
// expected sprites and holds are its shipped cycle files.
const values = frameCutConfigSchema.parse({});
const planner = new PlanFramesService();
const measured = (raw: unknown[]): FrameMeasure[] => raw.map((m) => frameMeasureSchema.parse(m));
const frame = (bottom: number, change = 0, headCenterX = 100): FrameMeasure => ({
	top: 10,
	bottom,
	left: 50,
	right: 150,
	legSpread: 40,
	headCenterX,
	change,
});

describe('PlanFramesService.planCycle', () => {
	it('cuts the M walk where the proof of concept did, with its holds and its drift', () => {
		const plan = planner.planCycle(measured(maleWalk), values);
		expect(plan.sprites.map((s) => s.source)).toEqual([13, 15, 18, 21, 24, 27, 28, 30, 31, 33, 36, 39]);
		expect(plan.sprites.map((s) => s.hold)).toEqual([2, 3, 3, 3, 3, 1, 2, 1, 2, 3, 3, 1]);
		expect(plan.driftPerVideoFrame).toBeCloseTo(7.256784, 5);
	});

	it('cuts the F walk within the bounds it was given, with its holds and its drift', () => {
		const plan = planner.planCycle(measured(femaleWalk), values, { first: 29, last: 56 });
		expect(plan.sprites.map((s) => s.source)).toEqual([29, 31, 34, 37, 40, 43, 46, 49, 52, 55]);
		expect(plan.sprites.map((s) => s.hold)).toEqual([2, 3, 3, 3, 3, 3, 3, 3, 3, 1]);
		expect(plan.driftPerVideoFrame).toBeCloseTo(6.663177, 5);
	});

	it('takes the third-last to the last maximum on its own, which for F spans two strides', () => {
		const plan = planner.planCycle(measured(femaleWalk), values);
		const last = plan.sprites.at(-1);
		expect([plan.sprites[0]?.source, last && last.source + last.hold]).toEqual([29, 68]);
	});

	it('starts a new pose only above the pose change, not at it', () => {
		const clip = [frame(200, 0), frame(200, 3), frame(200, 3.01), frame(200, 0)];
		expect(planner.planCycle(clip, values, { first: 0, last: 3 }).sprites.map((s) => [s.source, s.hold])).toEqual([
			[0, 2],
			[2, 1],
		]);
	});

	it('takes the whole clip when the spread has fewer than three maxima', () => {
		const flat = [frame(200, 0), frame(200, 9), frame(200, 9), frame(200, 9)];
		expect(planner.planCycle(flat, values).sprites.map((s) => s.source)).toEqual([0, 1, 2]);
	});

	it('shifts each sprite against the head drift since the first one and grounds it on the lowest row', () => {
		const clip = [frame(200, 0, 100), frame(198, 9, 102), frame(203, 9, 104), frame(200, 9, 106)];
		const plan = planner.planCycle(clip, values, { first: 0, last: 3 });
		expect(plan.sprites.map((s) => [s.shiftX, s.shiftY])).toEqual([
			[0, 3],
			[-2, 5],
			[-4, 0],
		]);
	});

	it('names a range beyond the measures with the missing frame key', () => {
		const failure: unknown = ((): unknown => {
			try {
				return planner.planCycle([frame(200)], values, { first: 0, last: 3 });
			} catch (error) {
				return error;
			}
		})();
		expect(failure instanceof FigureException && failure.key).toBe(FigureExceptionKey.MissingFrame);
	});
});

describe('PlanFramesService.planLoop', () => {
	it('plays a range forward only, one hold each, without drift', () => {
		const clip = Array.from({ length: 48 }, () => frame(200));
		const plan = planner.planLoop(clip, { first: 0, last: 47 }, 1, true, values);
		expect([plan.sprites.length, plan.sprites.every((s) => s.hold === 1 && s.shiftX === 0)]).toEqual([48, true]);
		expect(plan.driftPerVideoFrame).toBe(0);
	});

	it('plays forward and back again without repeating the turning frames', () => {
		const clip = Array.from({ length: 8 }, () => frame(200));
		expect(planner.planLoop(clip, { first: 0, last: 6 }, 2, false, values).sprites.map((s) => s.source)).toEqual([
			0, 2, 4, 6, 4, 2,
		]);
	});

	it('carries the margin and height it was given', () => {
		const plan = planner.planLoop([frame(200), frame(201)], { first: 0, last: 1 }, 1, true, values);
		expect([plan.margin, plan.height, plan.sprites.map((s) => s.shiftY)]).toEqual([values.margin, 200, [1, 0]]);
	});
});
