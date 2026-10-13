// motionAsset.interface.ts — one motion of a figure as the office gets it.
import type { FacePart } from './facePart.enum.ts';
import type { HeadPartKind } from './headPartKind.enum.ts';

/** Where a face part's image is drawn, in sprite pixels from the frame's head origin, and how large. */
export interface FacePlacement {
	readonly part: FacePart;
	readonly file: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** Where an image is drawn, in sprite pixels from the frame's head origin, and how large. */
export interface Placement {
	readonly file: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** Where a head part's variant is drawn, and for a hat where its hide is. */
export interface HeadPlacement extends Placement {
	readonly kind: HeadPartKind;
	readonly id: number;
	readonly hide?: Placement;
}

/** The frames with their holds, the sprite size, the walk's advance per video frame, the head per frame, the face,
 * and the head parts' variants when the figure has them. */
export interface MotionAsset {
	readonly frames: readonly { readonly file: string; readonly hold: number }[];
	readonly width: number;
	readonly height: number;
	readonly advance: number;
	readonly head: { readonly scale: number; readonly origin: readonly (readonly [number, number])[] };
	readonly face: readonly FacePlacement[];
	readonly parts?: readonly HeadPlacement[];
}
