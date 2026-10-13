// exportMotion.handler.ts — `pnpm assets export <figure> <motion>`: puts the motion, its face and head parts into the
// office's asset folder.
import { join } from 'node:path';
import {
	type ExportMotionService,
	FacePart,
	type FaceSource,
	HeadPartKind,
	type IMotionWork,
	type MakeHeadPartService,
} from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { figureMotion } from './figureMotion.ts';
import { headPaths } from './headPaths.ts';

/**
 * Exports the used sprites, the face and the head parts at the track's scale and the manifest entry; for a figure
 * with head parts also the lift of each hairstyle, measured on its layer, and the open hats.
 * @throws {FigureException} the invalid job key for unknown arguments or a missing cut or track; the cutter's and the
 * store's keys.
 */
export async function exportMotionHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: ExportMotionService,
	work: IMotionWork,
	headParts: MakeHeadPartService,
): Promise<string[]> {
	const { figure, motion, figureSpec, motionSpec } = figureMotion(args, setup.figures);
	const cut = await work.loadCut(figure, motion);
	const track = await work.loadTrack(figure, motion);
	const face = Object.values(FacePart).flatMap((part): FaceSource[] => {
		const source = figureSpec.face[part];
		if (!source) return [];
		const mask = source.mask ? { mask: join(setup.sources, source.mask) } : {};
		return [{ part, image: join(setup.sources, source.image), ...mask }];
	});
	const head = figureSpec.head;
	const paths = head ? headPaths(setup.rendersDir, figure) : undefined;
	const parts =
		head && paths
			? headParts.offered(
					head.kinds,
					(kind, id) => paths.layer(kind, id),
					(id) => paths.hide(id),
				)
			: [];
	const figureHead = head
		? await headParts.figureHead(
				join(setup.sources, head.open),
				setup.headCut,
				parts,
				head.kinds[HeadPartKind.Hat]?.openTop ?? [],
			)
		: undefined;
	const asset = await service.export({
		figure,
		motion,
		plan: cut.plan,
		cut: cut.result,
		...(motionSpec.use ? { use: motionSpec.use } : {}),
		track,
		face,
		...(head ? { head: parts, figureHead } : {}),
		values: setup.export,
	});
	return [
		`exported ${figure} ${motion}: ${String(asset.frames.length)} frames, ${String(asset.face.length)} face parts, ${String(asset.parts?.length ?? 0)} head parts`,
		setup.assets,
	];
}
