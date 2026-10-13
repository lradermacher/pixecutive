// clipJob.schema.ts — one motion clip the local video model is to render from a figure's approved still.
import { z } from 'zod';
import { ClipMode } from './clipMode.enum.ts';
import { FigureName } from './figureName.enum.ts';
import { frameCountSchema } from './frameCount.schema.ts';
import { Motion } from './motion.enum.ts';

/** A clip job as the command line hands it in; every field is checked before the model starts. */
export const clipJobSchema = z.object({
	figure: z.enum(FigureName),
	motion: z.enum(Motion),
	mode: z.enum(ClipMode),
	still: z.string().endsWith('.png'),
	promptFile: z.string().endsWith('.txt'),
	frames: frameCountSchema,
	endStrength: z.number().min(0).max(1),
});

export type ClipJob = z.infer<typeof clipJobSchema>;
