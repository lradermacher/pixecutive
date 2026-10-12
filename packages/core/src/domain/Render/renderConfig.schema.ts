// renderConfig.schema.ts — where the local renderer lives on this machine, parsed once when the app starts.
import { z } from 'zod';

/** None of these is a secret; each must name a real path, so a missing one stops the start instead of running on. */
export const renderConfigSchema = z.object({
	rendersDir: z.string().min(1),
	mflux: z.string().min(1),
	lora: z.string().endsWith('.safetensors'),
});

export type RenderConfig = z.infer<typeof renderConfigSchema>;
