// splitGrid.handler.ts — `pnpm assets split <figure> <kind> <drawing>`: a drawn grid into one still per variant.
import { join } from 'node:path';
import { FigureException, FigureExceptionKey, type MakeHeadPartService } from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { figureHeadKind } from './figureHeadKind.ts';
import { headPaths } from './headPaths.ts';

/**
 * Splits the kind's drawn grid cell by cell into the stills of the variants it drew, in their order.
 * @throws {FigureException} the invalid job key for a drawing without a grid or an unknown one; the cutter's keys.
 */
export async function splitGridHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: MakeHeadPartService,
): Promise<string[]> {
	const { figure, head, kind, kindSpec, number } = figureHeadKind(args, setup.figures);
	const draw = kindSpec.draws?.[number - 1];
	const grid = draw?.grid === undefined ? undefined : head.grids[draw.grid];
	if (grid === undefined || draw === undefined) {
		throw new FigureException(FigureExceptionKey.InvalidJob, `${figure} ${kind} has no drawn grid ${String(number)}`);
	}
	const paths = headPaths(setup.rendersDir, figure);
	const outs = draw.ids.map((id) => paths.still(kind, id));
	await service.split({ grid: paths.drawing(kind, number), layout: grid, base: join(setup.sources, grid.still), outs });
	return [`split ${figure} ${kind} ${String(number)}: variants ${draw.ids.join(', ')}`];
}
