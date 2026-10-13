// figureManifest.schema.ts — what the office reads about the base figures in `assets/figures/manifest.json`: per
// figure and motion its frames, size, advance, head origin per frame and where each face and head part sits on it.
// Written by the asset pipeline, never by hand.
import { z } from 'zod';
import { FacePart } from './facePart.enum.ts';
import { HeadPartKind } from './headPartKind.enum.ts';

/** A file under `assets/figures/`, as a relative path to a PNG. */
const file = z
	.string()
	.endsWith('.png')
	.refine((path) => !path.startsWith('/') && !path.split('/').includes('..'), 'a path inside the figures folder');

/** Where a face part's image is drawn, in sprite pixels from the head origin of the frame, and how large. */
const placementSchema = z.object({
	file,
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
});

/** A head part's variant: where it sits, and for a hat the hide that cuts the head away where the hat replaces it. */
const variantSchema = placementSchema.extend({ hide: placementSchema.optional() });

/** One motion: frames in play order with their hold in video frames, the sprite size, the walk's advance per video
 * frame (0 on the spot), the face's scale and head origin per frame, the face parts and per kind the head parts'
 * variants by their id. */
const motionSchema = z
	.object({
		frames: z.array(z.object({ file, hold: z.int().min(1) })).min(1),
		width: z.int().min(1),
		height: z.int().min(1),
		advance: z.number(),
		head: z.object({ scale: z.number().positive(), origin: z.array(z.tuple([z.number(), z.number()])).min(1) }),
		face: z.partialRecord(z.enum(FacePart), placementSchema),
		parts: z.partialRecord(z.enum(HeadPartKind), z.record(z.string().regex(/^[1-9][0-9]*$/), variantSchema)).optional(),
	})
	.refine((m) => m.head.origin.length === m.frames.length, 'one head origin per frame');

/**
 * What holds for a figure's head parts in every motion: how far a hat rises above the bald head for each hair, in
 * still pixels before the head's scale, and the hats open on top, which over hair neither hide the head nor rise.
 */
const headSchema = z.object({
	lift: z.record(z.string().regex(/^[1-9][0-9]*$/), z.int().min(0)),
	openTop: z.array(z.int().min(1)),
});

/** The manifest: its format version and, per figure (`m`, `f`) and motion (`idle`, `walk`, ...), the motion. */
export const figureManifestSchema = z.object({
	version: z.literal(1),
	figures: z.record(
		z.string().regex(/^[a-z]+$/),
		z.object({ head: headSchema.optional(), motions: z.record(z.string().regex(/^[a-z]+$/), motionSchema) }),
	),
});

export type FigureManifest = z.infer<typeof figureManifestSchema>;
