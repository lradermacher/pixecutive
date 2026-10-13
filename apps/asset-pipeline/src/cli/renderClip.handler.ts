// renderClip.handler.ts — `pnpm assets clip <figure> <motion>`: renders the motion's clip from its still.
import { join } from 'node:path';
import type { RenderClipService } from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { figureMotion } from './figureMotion.ts';

/**
 * Renders the clip the data file defines for the figure's motion and answers where it lies.
 * @throws {FigureException} the invalid job key for unknown arguments; the renderer's keys when it fails.
 */
export async function renderClipHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: RenderClipService,
): Promise<string[]> {
	const { figure, motion, motionSpec } = figureMotion(args, setup.figures);
	const result = await service.render({
		figure,
		motion,
		mode: motionSpec.mode,
		still: join(setup.sources, motionSpec.still),
		promptFile: join(setup.data, motionSpec.prompt),
		frames: motionSpec.frames,
		endStrength: motionSpec.endStrength,
	});
	return [`done ${figure} ${motion}`, result.clip];
}
