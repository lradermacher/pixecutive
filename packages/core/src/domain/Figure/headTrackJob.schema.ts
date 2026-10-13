// headTrackJob.schema.ts — what the head tracker needs: the still whose head the face parts were drawn on, the sprite
// frames, and the ear box on the still that checks the head's position independently.
import { z } from 'zod';
import { earBoxSchema } from './earBox.schema.ts';

const png = z.string().endsWith('.png');

/** A head-tracking job; the ear box is given in the still's pixels and must have an area. */
export const headTrackJobSchema = z.object({
	still: png,
	frames: z.array(png).min(1),
	ear: earBoxSchema,
});

export type HeadTrackJob = z.infer<typeof headTrackJobSchema>;
