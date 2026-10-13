// exportMotion.service.ts — the use case "export a motion": the sprites the office uses go into the asset store with
// their edges cleaned, the face parts at the motion's scale, and the motion's entry into the manifest.
import type { MotionAsset } from '../../domain/Figure/motionAsset.interface.ts';
import type { IAssetStore } from '../../port/outgoing/assetStore.interface.ts';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import type { ExportMotionCommand } from './exportMotionCommand.ts';

/**
 * Exports one motion of one figure.
 * @throws {FigureException} the invalid job key when the used range lies outside the sprites or the head track does
 * not cover exactly the used sprites; the store's storage key when it cannot write.
 */
export class ExportMotionService {
	constructor(private readonly store: IAssetStore) {}

	/** Selects the used sprites, stores them and the face, records the motion and answers its manifest entry. */
	async export(command: ExportMotionCommand): Promise<MotionAsset> {
		const { figure, motion, plan, cut, track, values } = command;
		const use = command.use ?? { first: 0, last: cut.frames.length - 1 };
		if (use.first < 0 || use.last >= cut.frames.length || use.first > use.last) {
			throw new FigureException(
				FigureExceptionKey.InvalidJob,
				`sprites ${String(use.first)} to ${String(use.last)} of ${String(cut.frames.length)}`,
			);
		}
		const used = cut.frames.slice(use.first, use.last + 1);
		if (track.origin.length !== used.length) {
			throw new FigureException(
				FigureExceptionKey.InvalidJob,
				`the head track has ${String(track.origin.length)} frames for ${String(used.length)} used sprites`,
			);
		}
		const stored = await this.store.putFrames(figure, motion, used, values);
		const face = await this.store.putFace(figure, motion, command.face, track.scale, values);
		const asset: MotionAsset = {
			frames: stored.files.map((file, k) => ({ file, hold: plan.sprites[use.first + k]?.hold ?? 1 })),
			width: stored.width,
			height: stored.height,
			advance: plan.driftPerVideoFrame * cut.scale,
			head: { scale: track.scale, origin: track.origin },
			face,
		};
		await this.store.putMotion(figure, motion, asset);
		return asset;
	}
}
