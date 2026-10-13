// cutPart.handler.ts — `pnpm assets cut <figure> <kind> <id>`: one variant cut out of its drawing into a layer.
import { HeadPartKind, type MakeHeadPartService } from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { figureHeadKind } from './figureHeadKind.ts';
import { headPaths } from './headPaths.ts';
import { headSources } from './headSources.ts';

/**
 * Cuts the variant's still into its layer; a hat also into its hide, hair under a hat against its hairstyle and hat.
 * @throws {FigureException} the invalid job key for an unknown variant; the cutter's keys.
 */
export async function cutPartHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: MakeHeadPartService,
): Promise<string[]> {
	const { figure, head, kind, kindSpec, number: id } = figureHeadKind(args, setup.figures);
	const paths = headPaths(setup.rendersDir, figure);
	const result = await service.cut({
		kind,
		values: setup.headCut,
		sources: headSources(setup.sources, setup.figures, figure, head),
		drawing: paths.still(kind, id),
		out: paths.layer(kind, id),
		...(kind === HeadPartKind.Hat ? { hide: paths.hide(id) } : {}),
		...(kind === HeadPartKind.HairUnderHat
			? { hairless: paths.layer(HeadPartKind.Hair, id), hat: paths.layer(HeadPartKind.Hat, kindSpec.hat ?? 0) }
			: {}),
	});
	const fit =
		result.scale === undefined ? '' : `, fit ${result.scale.toFixed(3)} at ${String(result.dx)},${String(result.dy)}`;
	return [`cut ${figure} ${kind} ${String(id)}: ${String(result.pixels)} pixels${fit}`];
}
