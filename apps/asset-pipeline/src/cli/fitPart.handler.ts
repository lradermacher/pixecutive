// fitPart.handler.ts — `pnpm assets fit <figure> <kind> <id>`: a variant made on another figure fitted to this one.
import { FigureException, FigureExceptionKey, type MakeHeadPartService } from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { figureHeadKind } from './figureHeadKind.ts';
import { headPaths } from './headPaths.ts';

/**
 * Fits the other figure's layer of this variant by the kind's scale and shift into this figure's layer.
 * @throws {FigureException} the invalid job key for a kind that is not fitted from another figure; the cutter's keys.
 */
export async function fitPartHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: MakeHeadPartService,
): Promise<string[]> {
	const { figure, kind, kindSpec, number: id } = figureHeadKind(args, setup.figures);
	const from = kindSpec.fittedFrom;
	if (from === undefined) {
		throw new FigureException(FigureExceptionKey.InvalidJob, `${figure} ${kind} is not fitted from another figure`);
	}
	const out = headPaths(setup.rendersDir, figure).layer(kind, id);
	await service.fit(headPaths(setup.rendersDir, from.figure).layer(kind, id), from, out);
	return [`fitted ${figure} ${kind} ${String(id)} from ${from.figure}: ${out}`];
}
