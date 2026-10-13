// cutFrames.handler.ts — `pnpm assets frames <figure> <motion>`: cuts the motion's clip into sprites and paints a
// motion's drawn finger states into them.
import { join } from 'node:path';
import type { CutFramesService, IMotionWork, PaintHandsService } from '@pixecutive/core';
import { VideoRendererLtxAdapter } from '@pixecutive/infrastructure';
import type { FigureSetup } from '../figureConfig.ts';
import { figureMotion } from './figureMotion.ts';

/**
 * Cuts the clip as the data file says (a loop's range, a cycle's bounds, a sprite height of its own) and keeps the
 * cut for the next command; a motion with hand states gets them painted into its sprites.
 * @throws {FigureException} the invalid job key for unknown arguments; the measurer's, cutter's and painter's keys.
 */
export async function cutFramesHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: CutFramesService,
	work: IMotionWork,
	hands: PaintHandsService,
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
	const { result } = cut;
	const lines = [
		`cut ${figure} ${motion}: ${String(result.frames.length)} sprites of ${String(result.width)}x${String(result.height)}`,
	];
	if (motionSpec.hands) {
		const sequence = await hands.paint({
			frames: result.frames,
			scale: result.scale,
			still: join(setup.sources, motionSpec.still),
			hands: { ...motionSpec.hands, states: motionSpec.hands.states.map((state) => join(setup.sources, state)) },
		});
		lines.push(`painted finger states into ${String(sequence.filter((state) => state !== null).length)} sprites`);
	}
	await work.saveCut(figure, motion, cut);
	return lines;
}
