// stillBox.schema.ts — a box on a figure's still in the still's pixels: the ear that checks the head track, the
// hands whose drawn states are painted into a motion's sprites.
import { z } from 'zod';

const pixel = z.int().min(0);

/** A box with an area, left and top inclusive, right and bottom exclusive. */
export const stillBoxSchema = z
	.object({ left: pixel, top: pixel, right: pixel, bottom: pixel })
	.refine((e) => e.right > e.left && e.bottom > e.top, 'a box has an area');

export type StillBox = z.infer<typeof stillBoxSchema>;
