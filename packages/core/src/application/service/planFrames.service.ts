// planFrames.service.ts — the decisions that turn a measured clip into sprites: a loop keeps its range, a cycle is
// cut at the leg spread's maxima with one sprite per new pose and its hold, the drift is the head's linear trend, and
// every sprite stands on the same ground row. Pure: it only reads the measures and the values.
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import type { FrameCutConfig } from '../../domain/Figure/frameCutConfig.schema.ts';
import type { FrameMeasure } from '../../domain/Figure/frameMeasure.schema.ts';
import type { FramePlan } from '../../domain/Figure/framePlan.schema.ts';

/** A range of video frames, first and last included. */
export interface FrameRange {
	first: number;
	last: number;
}

/**
 * Plans the sprites of a clip from its frame measures.
 * @throws {FigureException} the missing frame key when a range reaches beyond the measures.
 */
export class PlanFramesService {
	/**
	 * A loop: every `step`-th frame of the range, played forward only (`forward`) or forward and back again.
	 * Nothing drifts in a loop; each sprite is grounded on the lowest row of the range.
	 * @throws {FigureException} the missing frame key when the range reaches beyond the measures.
	 */
	planLoop(
		measures: readonly FrameMeasure[],
		range: FrameRange,
		step: number,
		forward: boolean,
		values: FrameCutConfig,
	): FramePlan {
		const ahead: number[] = [];
		for (let i = range.first; i <= range.last; i += step) ahead.push(i);
		const order = forward ? ahead : [...ahead, ...ahead.slice(1, -1).reverse()];
		return this.plan(
			measures,
			order,
			order.map(() => 1),
			0,
			values,
		);
	}

	/**
	 * A cycle: between the third-last and the last maximum of the smoothed leg spread (or `bounds` when given), one
	 * sprite where the pose changes, held until the next one; the head's linear drift is shifted out.
	 * @throws {FigureException} the missing frame key when the bounds reach beyond the measures.
	 */
	planCycle(measures: readonly FrameMeasure[], values: FrameCutConfig, bounds?: FrameRange): FramePlan {
		const [first, last] = bounds ? [bounds.first, bounds.last] : this.cycleBounds(measures);
		const order: number[] = [];
		for (let i = first; i < last; i++)
			if (i === first || this.at(measures, i).change > values.poseChange) order.push(i);
		const holds = order.map((source, k) => (order[k + 1] ?? last) - source);
		const drift = slope(
			order,
			order.map((i) => this.at(measures, i).headCenterX),
		);
		return this.plan(measures, order, holds, drift, values);
	}

	/** The cycle runs from the third-last to the last maximum of the spread, or over the whole clip without three. */
	private cycleBounds(measures: readonly FrameMeasure[]): [number, number] {
		const spread = smooth(measures.map((m) => m.legSpread));
		const middle = median(spread);
		const maxima: number[] = [];
		for (let i = 1; i < spread.length - 1; i++) {
			const [before, here, after] = [spread[i - 1] ?? 0, spread[i] ?? 0, spread[i + 1] ?? 0];
			if (here >= before && here > after && here > middle) maxima.push(i);
		}
		return maxima.length >= 3
			? [maxima[maxima.length - 3] ?? 0, maxima[maxima.length - 1] ?? 0]
			: [0, measures.length - 1];
	}

	private plan(
		measures: readonly FrameMeasure[],
		order: readonly number[],
		holds: readonly number[],
		drift: number,
		values: FrameCutConfig,
	): FramePlan {
		const ground = Math.max(...order.map((i) => this.at(measures, i).bottom));
		const first = order[0] ?? 0;
		return {
			sprites: order.map((source, k) => ({
				source,
				hold: holds[k] ?? 1,
				shiftX: drift * (first - source),
				shiftY: ground - this.at(measures, source).bottom,
			})),
			margin: values.margin,
			height: values.height,
			driftPerVideoFrame: drift,
		};
	}

	private at(measures: readonly FrameMeasure[], i: number): FrameMeasure {
		const measure = measures[i];
		if (!measure)
			throw new FigureException(
				FigureExceptionKey.MissingFrame,
				`no measure for video frame ${String(i)} of ${String(measures.length)}`,
			);
		return measure;
	}
}

/** A moving mean over three frames; beyond the clip counts as zero, as in a same-size convolution. */
function smooth(values: readonly number[]): number[] {
	return values.map((v, i) => ((values[i - 1] ?? 0) + v + (values[i + 1] ?? 0)) / 3);
}

/** The middle value; between the two middle values for an even count. */
function median(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** The least-squares slope of y over x; zero when x does not vary. */
function slope(x: readonly number[], y: readonly number[]): number {
	const n = x.length;
	const mx = x.reduce((s, v) => s + v, 0) / n;
	const my = y.reduce((s, v) => s + v, 0) / n;
	let num = 0;
	let den = 0;
	x.forEach((v, i) => {
		num += (v - mx) * ((y[i] ?? 0) - my);
		den += (v - mx) ** 2;
	});
	return den === 0 ? 0 : num / den;
}
