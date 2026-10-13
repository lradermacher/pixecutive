// figureManifest.schema.ts — what the office reads about the base figures in `assets/figures/manifest.json`: per
// figure and motion its sprite frames with their holds, the sprite size, how far a walk advances, where the head is
// in every frame and where each face part sits on it. Written by the asset pipeline, never by hand.
import { z } from 'zod';
import { FacePart } from './facePart.enum.ts';

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

/** One motion: frames in play order with their hold in video frames, the sprite size, the walk's advance per video
 * frame (0 on the spot), the face's scale and head origin per frame, and the face parts. */
const motionSchema = z
	.object({
		frames: z.array(z.object({ file, hold: z.int().min(1) })).min(1),
		width: z.int().min(1),
		height: z.int().min(1),
		advance: z.number(),
		head: z.object({ scale: z.number().positive(), origin: z.array(z.tuple([z.number(), z.number()])).min(1) }),
		face: z.partialRecord(z.enum(FacePart), placementSchema),
	})
	.refine((m) => m.head.origin.length === m.frames.length, 'one head origin per frame');

/** The manifest: its format version and, per figure (`m`, `f`) and motion (`idle`, `walk`, ...), the motion. */
export const figureManifestSchema = z.object({
	version: z.literal(1),
	figures: z.record(
		z.string().regex(/^[a-z]+$/),
		z.object({ motions: z.record(z.string().regex(/^[a-z]+$/), motionSchema) }),
	),
});

export type FigureManifest = z.infer<typeof figureManifestSchema>;
