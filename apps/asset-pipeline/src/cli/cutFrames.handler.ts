// cutFrames.handler.ts — `pnpm assets frames <figure> <motion>`: cuts the motion's clip into sprites.
import type { CutFramesService, IMotionWork } from '@pixecutive/core';
import { VideoRendererLtxAdapter } from '@pixecutive/infrastructure';
import type { FigureSetup } from '../figureConfig.ts';
import { figureMotion } from './figureMotion.ts';

/**
 * Cuts the clip as the data file says (a loop's range, a cycle's bounds, a sprite height of its own) and keeps the
 * cut for the next command.
 * @throws {FigureException} the invalid job key for unknown arguments; the measurer's and cutter's keys.
 */
export async function cutFramesHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: CutFramesService,
	work: IMotionWork,
): Promise<string[]> {
	const { figure, motion, motionSpec } = figureMotion(args, setup.figures);
	const cut = await service.cut({
		clip: VideoRendererLtxAdapter.clipOf(setup.rendersDir, figure, motion),
		mode: motionSpec.mode,
		values: motionSpec.height === undefined ? setup.cut : { ...setup.cut, height: motionSpec.height },
		...(motionSpec.range ? { range: motionSpec.range } : {}),
		...(motionSpec.step === undefined ? {} : { step: motionSpec.step }),
		...(motionSpec.forward === undefined ? {} : { forward: motionSpec.forward }),
	});
	await work.saveCut(figure, motion, cut);
	const { result } = cut;
	return [
		`cut ${figure} ${motion}: ${String(result.frames.length)} sprites of ${String(result.width)}x${String(result.height)}`,
	];
}
