// motionAsset.interface.ts — one motion of a figure as the office gets it.
import type { FacePart } from './facePart.enum.ts';

/** Where a face part's image is drawn, in sprite pixels from the frame's head origin, and how large. */
export interface FacePlacement {
	readonly part: FacePart;
	readonly file: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** The frames with their holds, the sprite size, the walk's advance per video frame, the head per frame, the face. */
export interface MotionAsset {
	readonly frames: readonly { readonly file: string; readonly hold: number }[];
	readonly width: number;
	readonly height: number;
	readonly advance: number;
	readonly head: { readonly scale: number; readonly origin: readonly (readonly [number, number])[] };
	readonly face: readonly FacePlacement[];
}
