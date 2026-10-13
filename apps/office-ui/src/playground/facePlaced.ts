// facePlaced.ts — where the face parts of a motion are drawn in one frame, in sprite pixels: the frame's head origin
// plus the part's offset, back to front, with the eyes open and the mouth in the state asked for.
import { FacePart } from '@pixecutive/protocol';
import type { ManifestMotion } from './manifestMotion.interface.ts';

/** One face part to draw: its file and its box in the sprite. */
export interface PlacedPart {
	readonly file: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/**
 * Back to front. The idle sprites keep the face of the still they were cut from, so the blank head covers it before
 * the parts go on; the walk sprites come from a still with a blank face and need none.
 */
const layers: readonly FacePart[] = [FacePart.Blank, FacePart.Brows, FacePart.Eyes, FacePart.Nose];
const blankHeadMotion = 'idle';

/**
 * The parts the motion has, placed on the head origin of `frame`, the mouth as `mouth` (the closed mouth where the
 * motion has no such state).
 */
export function facePlaced(
	name: string,
	motion: ManifestMotion,
	frame: number,
	mouth: FacePart = FacePart.Mouth,
): PlacedPart[] {
	const [x, y] = motion.head.origin[frame] ?? [0, 0];
	return [...layers, motion.face[mouth] ? mouth : FacePart.Mouth].flatMap((part) => {
		const placement = motion.face[part];
		if (!placement || (part === FacePart.Blank && name !== blankHeadMotion)) return [];
		return [{ ...placement, x: x + placement.x, y: y + placement.y }];
	});
}
