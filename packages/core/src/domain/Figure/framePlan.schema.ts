// framePlan.schema.ts — what the core decided for a clip: which video frames become sprites, how long each holds,
// how each is shifted, the margin around the figure and the sprite height. The cutter measures the shifted frames
// and applies these values; the geometry it measures is its own, the decisions are here.
import { z } from 'zod';

const row = z.int().min(0);

/** One sprite: its video frame, its hold in video frames and the shift that grounds it and removes the drift. */
const spriteSchema = z.object({
	source: row,
	hold: z.int().min(1),
	shiftX: z.number(),
	shiftY: z.int(),
});

/** The sprites of a motion in play order, the margin kept around the figure (video px) and the sprite height (px). */
export const framePlanSchema = z.object({
	sprites: z.array(spriteSchema).min(1),
	margin: z.object({ top: row, bottom: row, left: row, right: row }),
	height: z.int().min(16).max(1024),
	driftPerVideoFrame: z.number(),
});

export type FramePlan = z.infer<typeof framePlanSchema>;
