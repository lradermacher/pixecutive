// assetStore.interface.ts — where a figure's office assets go: the sprite frames, the face parts and the manifest.
import type { ExportConfig } from '../../domain/Figure/exportConfig.schema.ts';
import type { FaceSource } from '../../domain/Figure/faceSource.interface.ts';
import type { FigureName } from '../../domain/Figure/figureName.enum.ts';
import type { Motion } from '../../domain/Figure/motion.enum.ts';
import type { FacePlacement, MotionAsset } from '../../domain/Figure/motionAsset.interface.ts';

/**
 * The asset store. Every method rejects with a `FigureException` (storage failed) when a file cannot be written, and
 * a written image stays within the office's size limit.
 */
export interface IAssetStore {
	/** Writes the sprites in order with their edges freed of the clip's background; answers their files and size. */
	putFrames(
		figure: FigureName,
		motion: Motion,
		sprites: readonly string[],
		values: ExportConfig,
	): Promise<{ files: string[]; width: number; height: number }>;
	/** Writes each face part scaled from the still to the motion's sprites; answers where each is drawn. */
	putFace(
		figure: FigureName,
		motion: Motion,
		sources: readonly FaceSource[],
		scale: number,
		values: ExportConfig,
	): Promise<FacePlacement[]>;
	/** Records the motion in the manifest, replacing an earlier entry of the same figure and motion. */
	putMotion(figure: FigureName, motion: Motion, asset: MotionAsset): Promise<void>;
}
