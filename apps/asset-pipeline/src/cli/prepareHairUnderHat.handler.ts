// prepareHairUnderHat.handler.ts — `pnpm assets hair-under-hat <figure> <id>`: the input on which the image model
// redraws a hairstyle as it lies under the hat.
import { FigureException, FigureExceptionKey, HeadPartKind, type MakeHeadPartService } from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { figureHead } from './figureHead.ts';
import { headPaths } from './headPaths.ts';

/**
 * Writes the hairstyle's still with the hat on top, flat magenta and shrunk, for the drawing of hair under the hat.
 * @throws {FigureException} the invalid job key for a figure without hair under a hat or an id it lacks; the cutter's
 * keys.
 */
export async function prepareHairUnderHatHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: MakeHeadPartService,
): Promise<string[]> {
	const { figure, head } = figureHead(args, setup.figures);
	const spec = head.kinds[HeadPartKind.HairUnderHat];
	const id = Number(args[1]);
	if (spec?.hat === undefined || spec.shrink === undefined || !spec.ids.includes(id)) {
		throw new FigureException(FigureExceptionKey.InvalidJob, `${figure} has no hair under a hat ${args[1] ?? ''}`);
	}
	const paths = headPaths(setup.rendersDir, figure);
	const out = paths.underHatInput(id);
	await service.underHat(paths.still(HeadPartKind.Hair, id), paths.layer(HeadPartKind.Hat, spec.hat), spec.shrink, out);
	return [`hair under hat ${figure} ${String(id)}: ${out}`];
}
