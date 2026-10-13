// tileTransform.ts — how a figure of sprite size is put on its tile: scaled by a whole zoom, and for front-right
// mirrored about its own box, so every layer flips with it.
import { Facing } from './facing.enum.ts';

/** The canvas transform `[a, b, c, d, e, f]` that draws a figure `width` pixels wide at `zoom` facing `facing`. */
export function tileTransform(
	width: number,
	zoom: number,
	facing: Facing,
): [number, number, number, number, number, number] {
	return facing === Facing.FrontRight ? [-zoom, 0, 0, zoom, width * zoom, 0] : [zoom, 0, 0, zoom, 0, 0];
}
