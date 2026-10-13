import { describe, expect, it } from 'vitest';
import { ClipMode } from '../../domain/Figure/clipMode.enum.ts';
import type { CutResult } from '../../domain/Figure/cutResult.schema.ts';
import { type FrameCutConfig, frameCutConfigSchema } from '../../domain/Figure/frameCutConfig.schema.ts';
import type { FrameMeasure } from '../../domain/Figure/frameMeasure.schema.ts';
import type { FramePlan } from '../../domain/Figure/framePlan.schema.ts';
import type { IFrameCutter } from '../../port/outgoing/frameCutter.interface.ts';
import type { IFrameMeasurer } from '../../port/outgoing/frameMeasurer.interface.ts';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import { CutFramesService } from './cutFrames.service.ts';

const values = frameCutConfigSchema.parse({});
const still = (bottom: number, change: number): FrameMeasure => ({
	top: 10,
	bottom,
	left: 50,
	right: 150,
	legSpread: 40,
	headCenterX: 100,
	change,
});

/** Answers the same measures for every clip and keeps which clip it measured with which pose change. */
class InMemoryFrameMeasurer implements IFrameMeasurer {
	readonly seen: [string, number][] = [];
	constructor(private readonly measures: FrameMeasure[]) {}

	measure(clip: string, values: FrameCutConfig): Promise<FrameMeasure[]> {
		this.seen.push([clip, values.poseChange]);
		return Promise.resolve(this.measures);
	}
}

/** Keeps every plan it was handed and names one sprite file per planned frame, at the height it was given. */
class InMemoryFrameCutter implements IFrameCutter {
	readonly plans: FramePlan[] = [];

	cut(clip: string, plan: FramePlan, values: FrameCutConfig): Promise<CutResult> {
		this.plans.push(plan);
		return Promise.resolve({
			frames: plan.sprites.map((_, k) => `${clip}-${String(k).padStart(2, '0')}.png`),
			scale: 0.33,
			width: 90,
			height: values.height,
		});
	}
}

describe('CutFramesService', () => {
	it('cuts a loop over the whole clip, forward, when no range is given', async () => {
		const cutter = new InMemoryFrameCutter();
		const measurer = new InMemoryFrameMeasurer([still(200, 0), still(200, 1), still(201, 1)]);
		const { plan, result } = await new CutFramesService(measurer, cutter).cut({
			clip: 'idle',
			mode: ClipMode.Loop,
			values,
		});
		expect(plan.sprites.map((s) => s.source)).toEqual([0, 1, 2]);
		expect([result.frames, result.height]).toEqual([['idle-00.png', 'idle-01.png', 'idle-02.png'], 200]);
		expect([measurer.seen, cutter.plans]).toEqual([[['idle', 3]], [plan]]);
	});

	it('cuts a loop over its range, every step, forward and back', async () => {
		const clip = Array.from({ length: 9 }, () => still(200, 0));
		const { plan } = await new CutFramesService(new InMemoryFrameMeasurer(clip), new InMemoryFrameCutter()).cut({
			clip: 'idle',
			mode: ClipMode.Loop,
			values,
			range: { first: 2, last: 8 },
			step: 3,
			forward: false,
		});
		expect(plan.sprites.map((s) => s.source)).toEqual([2, 5, 8, 5]);
	});

	it('cuts a cycle within the bounds it is given, one sprite per new pose', async () => {
		const clip = [still(200, 0), still(200, 9), still(200, 1), still(200, 9), still(200, 0)];
		const { plan } = await new CutFramesService(new InMemoryFrameMeasurer(clip), new InMemoryFrameCutter()).cut({
			clip: 'walk',
			mode: ClipMode.Cycle,
			values,
			range: { first: 0, last: 4 },
		});
		expect(plan.sprites.map((s) => [s.source, s.hold])).toEqual([
			[0, 1],
			[1, 2],
			[3, 1],
		]);
	});

	it('never starts the cutter when the range reaches beyond the clip', async () => {
		const cutter = new InMemoryFrameCutter();
		const failure: unknown = await new CutFramesService(new InMemoryFrameMeasurer([still(200, 0)]), cutter)
			.cut({ clip: 'idle', mode: ClipMode.Loop, values, range: { first: 0, last: 5 } })
			.catch((error: unknown) => error);
		expect([failure instanceof FigureException && failure.key, cutter.plans]).toEqual([
			FigureExceptionKey.MissingFrame,
			[],
		]);
	});
});
