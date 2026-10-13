// cutResult.schema.ts — what cutting a clip into sprites left behind, as the cutter reports it.
import { z } from 'zod';

/** The sprite files in play order, the scale from video to sprite pixels and the common sprite size. */
export const cutResultSchema = z.object({
	frames: z.array(z.string().endsWith('.png')).min(1),
	scale: z.number().positive(),
	width: z.int().min(1),
	height: z.int().min(1),
});

export type CutResult = z.infer<typeof cutResultSchema>;
