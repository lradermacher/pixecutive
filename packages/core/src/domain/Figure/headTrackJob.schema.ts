// headTrackJob.schema.ts — what the head tracker needs: the still whose head the face parts were drawn on, the sprite
// frames, and the ear box on the still that checks the head's position independently.
import { z } from 'zod';

const png = z.string().endsWith('.png');
const pixel = z.int().min(0);

/** A head-tracking job; the ear box is given in the still's pixels and must have an area. */
export const headTrackJobSchema = z.object({
	still: png,
	frames: z.array(png).min(1),
	ear: z
		.object({ left: pixel, top: pixel, right: pixel, bottom: pixel })
		.refine((e) => e.right > e.left && e.bottom > e.top, 'an ear box has an area'),
});

export type HeadTrackJob = z.infer<typeof headTrackJobSchema>;
