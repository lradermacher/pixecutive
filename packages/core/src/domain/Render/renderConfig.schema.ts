// renderConfig.schema.ts — where the local renderer lives on this machine, parsed once when the app starts.
import { z } from 'zod';

/** None of these is a secret; the schema checks their form, the app checks at its start that the files exist. */
export const renderConfigSchema = z.object({
	rendersDir: z.string().min(1),
	mflux: z.string().min(1),
	lora: z.string().endsWith('.safetensors'),
});

export type RenderConfig = z.infer<typeof renderConfigSchema>;
