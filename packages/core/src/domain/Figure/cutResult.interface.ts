// cutResult.interface.ts — what cutting a clip into sprites left behind.

/** The sprite files in play order, the scale from video to sprite pixels and the common sprite size. */
export interface CutResult {
	readonly frames: readonly string[];
	readonly scale: number;
	readonly width: number;
	readonly height: number;
}
