// handPaintJob.interface.ts — what the hand painter needs to paint drawn finger states into a motion's sprites.
import type { StillBox } from './stillBox.schema.ts';

/**
 * The sprites, the still the hands were drawn on and its scale to the sprites, the hands' box, the state drawings,
 * and per sprite the state painted into it (null keeps the sprite's own hands).
 */
export interface HandPaintJob {
	readonly frames: readonly string[];
	readonly still: string;
	readonly scale: number;
	readonly box: StillBox;
	readonly states: readonly string[];
	readonly sequence: readonly (number | null)[];
	/** Sprite pixels from the last sprite's hands within which they are searched. */
	readonly reach: number;
}
