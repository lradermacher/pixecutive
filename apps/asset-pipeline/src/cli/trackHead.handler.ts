// trackHead.handler.ts — `pnpm assets track <figure> <motion>`: tracks the head through the sprites the office uses.
import { join } from 'node:path';
import type { IMotionWork, TrackHeadService } from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { figureMotion } from './figureMotion.ts';

/**
 * Tracks the head of the used sprites against the motion's still and keeps the track for the export.
 * @throws {FigureException} the invalid job key for unknown arguments or a missing cut; head drift; the tracker's keys.
 */
export async function trackHeadHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: TrackHeadService,
	work: IMotionWork,
): Promise<string[]> {
	const { figure, motion, figureSpec, motionSpec } = figureMotion(args, setup.figures);
	const { result } = await work.loadCut(figure, motion);
	const use = motionSpec.use ?? { first: 0, last: result.frames.length - 1 };
	const frames = result.frames.slice(use.first, use.last + 1);
	const track = await service.track({
		still: join(setup.sources, motionSpec.trackStill),
		frames,
		ear: figureSpec.ear,
		values: setup.track,
	});
	await work.saveTrack(figure, motion, track);
	const ear = Math.max(...track.earOffset);
	return [
		`tracked ${figure} ${motion}: ${String(frames.length)} frames at scale ${track.scale.toFixed(4)}, ear within ${ear.toFixed(2)} px`,
	];
}
