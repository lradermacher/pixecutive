// exportMotion.handler.ts — `pnpm assets export <figure> <motion>`: puts the motion into the office's asset folder.
import { join } from 'node:path';
import { type ExportMotionService, FacePart, type FaceSource, type IMotionWork } from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { figureMotion } from './figureMotion.ts';

/**
 * Exports the used sprites, the face at the track's scale and the manifest entry.
 * @throws {FigureException} the invalid job key for unknown arguments or a missing cut or track; the store's keys.
 */
export async function exportMotionHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: ExportMotionService,
	work: IMotionWork,
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
	const asset = await service.export({
		figure,
		motion,
		plan: cut.plan,
		cut: cut.result,
		...(motionSpec.use ? { use: motionSpec.use } : {}),
		track,
		face,
		values: setup.export,
	});
	return [
		`exported ${figure} ${motion}: ${String(asset.frames.length)} frames, ${String(asset.face.length)} face parts`,
		setup.assets,
	];
}
