// clipJob.schema.ts — one motion clip the local video model is to render from a figure's approved still.
import { z } from 'zod';
import { ClipMode } from './clipMode.enum.ts';
import { FigureName } from './figureName.enum.ts';
import { Motion } from './motion.enum.ts';

/** The video model renders 8k + 1 frames; 9 is its shortest clip, 257 the longest that fits the memory. */
const frameCount = z
	.int()
	.min(9)
	.max(257)
	.refine((n) => (n - 1) % 8 === 0, 'a clip has 8k + 1 frames');

/** A clip job as the command line hands it in; every field is checked before the model starts. */
export const clipJobSchema = z.object({
	figure: z.enum(FigureName),
	motion: z.enum(Motion),
	mode: z.enum(ClipMode),
	still: z.string().endsWith('.png'),
	promptFile: z.string().endsWith('.txt'),
	frames: frameCount,
	endStrength: z.number().min(0).max(1),
});

export type ClipJob = z.infer<typeof clipJobSchema>;
