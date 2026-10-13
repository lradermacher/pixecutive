// buildGrid.handler.ts — `pnpm assets grid <figure> <grid>`: the grid image the image model draws several variants in.
import { join } from 'node:path';
import { FigureException, FigureExceptionKey, type MakeHeadPartService } from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { figureHead } from './figureHead.ts';
import { headPaths } from './headPaths.ts';

/**
 * Writes the named grid of the figure: the grid's still box once per cell.
 * @throws {FigureException} the invalid job key for an unknown figure or grid; the cutter's keys.
 */
export async function buildGridHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: MakeHeadPartService,
): Promise<string[]> {
	const { figure, head } = figureHead(args, setup.figures);
	const name = args[1] ?? '';
	const grid = head.grids[name];
	if (grid === undefined) {
		throw new FigureException(
			FigureExceptionKey.InvalidJob,
			`${figure} has no grid ${name}; it has ${Object.keys(head.grids).join(', ')}`,
		);
	}
	const out = headPaths(setup.rendersDir, figure).grid(name);
	await service.grid(join(setup.sources, grid.still), grid, out);
	return [`grid ${figure} ${name}: ${out}`];
}
