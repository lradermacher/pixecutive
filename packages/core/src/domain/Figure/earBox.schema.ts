// earBox.schema.ts — the box around the ear on a figure's still, in the still's pixels: the head tracker checks the
// head's position by it, independently of the head match.
import { z } from 'zod';

const pixel = z.int().min(0);

/** An ear box; it must have an area. */
export const earBoxSchema = z
	.object({ left: pixel, top: pixel, right: pixel, bottom: pixel })
	.refine((e) => e.right > e.left && e.bottom > e.top, 'an ear box has an area');

export type EarBox = z.infer<typeof earBoxSchema>;
