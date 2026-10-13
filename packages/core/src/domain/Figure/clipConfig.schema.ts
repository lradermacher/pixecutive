// clipConfig.schema.ts — where the local video model lives on this machine and how every clip is rendered; parsed at
// the app's start. The values are the ones the shipped base figures' clips were rendered with.
import { z } from 'zod';

const path = z.string().min(1);

/** The renders folder, uv and the video model's checkout and weights, and the settings every clip shares. */
export const clipConfigSchema = z.object({
	rendersDir: path,
	uv: path.default('uv'),
	ltxProject: path,
	model: path,
	/** Said after every motion's own prompt: the view, the background and the camera the cut relies on. */
	promptSuffix: z
		.string()
		.default(', three-quarter view, plain light blue background, static locked camera, same character in every frame'),
	frameRate: z.int().min(1).max(60).default(24),
	/** The square the still is placed on and the clip is rendered at (px). */
	size: z.int().min(256).max(1536).multipleOf(32).default(768),
});

export type ClipConfig = z.infer<typeof clipConfigSchema>;
