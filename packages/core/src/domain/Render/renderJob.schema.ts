// renderJob.schema.ts — one image a local model is to render: its prompt, its input image, its seed and its size.
import { z } from 'zod';

/** The model works on a 16 pixel grid; smaller than 256 loses the figure, larger than 2048 exhausts the memory. */
const side = z.int().min(256).max(2048).multipleOf(16);

/** A render job as the command line hands it in; every field is checked before the model starts. */
export const renderJobSchema = z.object({
	promptFile: z.string().endsWith('.txt'),
	inputImage: z.string().endsWith('.png'),
	seed: z.int().min(0).max(4294967295),
	width: side,
	height: side,
});

export type RenderJob = z.infer<typeof renderJobSchema>;
