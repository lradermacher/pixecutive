// referenceTemplate.schema.ts — what the image model must deliver for every figure: views, pose, background, size.
import { z } from 'zod';
import { View } from './view.enum.ts';

/**
 * The fixed frame of every reference render. `prompt` is the base text; the figure's feature sentences are inserted
 * where `{features}` stands, so every figure gets the same views, pose and flat key-colored background.
 */
export const referenceTemplateSchema = z.object({
	views: z.array(z.enum(View)).min(1),
	prompt: z.string().includes('{features}'),
	width: z.int().positive(),
	height: z.int().positive(),
	seed: z.int().nonnegative(),
	keyColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export type ReferenceTemplate = z.infer<typeof referenceTemplateSchema>;
