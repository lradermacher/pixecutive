// errorType.schema.ts — known failures of the image model and their countermeasures in the prompt.
import { z } from 'zod';

/**
 * A failure mode of the image model. `strip` removes phrases that cause it; `forbid` rejects a prompt that still
 * contains a phrase known to cause it.
 */
const errorTypeSchema = z.object({
	id: z.string().min(1),
	description: z.string().min(1),
	strip: z.array(z.string().min(1)),
	forbid: z.array(z.string().min(1)),
});

/** The error-types file: every known failure mode of the image model. */
export const errorTypesSchema = z.object({ types: z.array(errorTypeSchema) });

export type ErrorType = z.infer<typeof errorTypeSchema>;
