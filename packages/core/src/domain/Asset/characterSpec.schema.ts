// characterSpec.schema.ts — what a figure must look like: its features with prompt sentence, check and source.
import { z } from 'zod';
import { Animation } from './animation.enum.ts';
import { FeatureCheck } from './featureCheck.enum.ts';
import { Joint } from './joint.enum.ts';

/** One feature of a figure; `source` names where it was decided, a sheet answer or the maintainer's words. */
const featureSchema = z.object({
	id: z.string().min(1),
	description: z.string().min(1),
	promptSentence: z.string(),
	check: z.enum(FeatureCheck),
	source: z.string().min(1),
});

/** The spec of one figure: the reference it starts from, its features, joints and animations. */
export const characterSpecSchema = z.object({
	id: z.string().min(1),
	baseImage: z.string().min(1),
	features: z.array(featureSchema).min(1),
	joints: z.array(z.enum(Joint)),
	animations: z.array(z.enum(Animation)),
});

export type Feature = z.infer<typeof featureSchema>;
export type CharacterSpec = z.infer<typeof characterSpecSchema>;
