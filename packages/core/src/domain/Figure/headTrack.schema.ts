// headTrack.schema.ts — where the still's head lands in each sprite frame, and the ear check beside it.
import { z } from 'zod';

const point = z.tuple([z.number(), z.number()]);

/** The face parts' scale, the head origin per frame and how far the ear strayed from the head in each frame (px). */
export const headTrackSchema = z
	.object({
		scale: z.number().positive(),
		origin: z.array(point).min(1),
		earOffset: z.array(z.number().min(0)).min(1),
	})
	.refine((t) => t.origin.length === t.earOffset.length, 'one ear check per frame');

export type HeadTrack = z.infer<typeof headTrackSchema>;
