// headroom.ts — how far the head parts of a motion reach past its sprite in any frame, so the figure is assembled on a
// canvas that holds them: a tall hat, a hat raised over hair, long hair beside the shoulders.
import type { ManifestMotion } from './manifestMotion.interface.ts';

/** Whole sprite pixels the canvas grows by above, left and right of the sprite. */
export interface Headroom {
	readonly top: number;
	readonly left: number;
	readonly right: number;
}

/** The most a hat rises above its drawing for the hair under it, in still pixels. */
const mostLift = 30;

/**
 * The room every head part of the motion needs past the sprite in its farthest frame; a hat is counted as raised by
 * the most lift and grown with it.
 */
export function headroom(motion: ManifestMotion): Headroom {
	const lift = mostLift * motion.head.scale;
	const boxes = Object.entries(motion.parts ?? {}).flatMap(([kind, variants]) =>
		Object.values(variants).map((p) => {
			const grow = kind === 'hat' ? (p.height + 0.5 * lift) / p.height : 1;
			return { x: p.x - (p.width * (grow - 1)) / 2, y: p.y - (kind === 'hat' ? lift : 0), w: p.width * grow };
		}),
	);
	let top = 0;
	let left = 0;
	let right = 0;
	for (const [ox, oy] of motion.head.origin) {
		for (const box of boxes) {
			top = Math.max(top, -(oy + box.y));
			left = Math.max(left, -(ox + box.x));
			right = Math.max(right, ox + box.x + box.w - motion.width);
		}
	}
	return { top: Math.ceil(top), left: Math.ceil(left), right: Math.ceil(right) };
}
