// framePlan.schema.ts — what the core decided for a clip: which video frames become sprites, how long each holds,
// how each is shifted, and the box and scale every sprite is cut to.
import { z } from 'zod';

const row = z.int().min(0);

/** One sprite: its video frame, its hold in video frames and the shift that grounds it and removes the drift. */
const spriteSchema = z.object({
	source: row,
	hold: z.int().min(1),
	shiftX: z.number(),
	shiftY: z.int(),
});

/** The sprites of a motion in play order, the common crop box in video pixels and the scale to sprite size. */
export const framePlanSchema = z.object({
	sprites: z.array(spriteSchema).min(1),
	crop: z
		.object({ top: row, bottom: row, left: row, right: row })
		.refine((c) => c.bottom > c.top && c.right > c.left, 'a crop box has an area'),
	scale: z.number().positive(),
	advancePerVideoFrame: z.number(),
});

export type FramePlan = z.infer<typeof framePlanSchema>;
