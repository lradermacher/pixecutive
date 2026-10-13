// headTrackConfig.schema.ts — the values that track the still's head through the sprites, each with the default the
// shipped base figures were tracked with. Parsed at the app's start; a test pins them.
import { z } from 'zod';

/** How the head is found on the still, how far the sprites are padded, and the range of scales searched. */
export const headTrackConfigSchema = z
	.object({
		/** Color distance (sum of RGB) above which a still pixel belongs to the figure. */
		background: z.int().min(1).max(765).default(60),
		/** Share of the figure's height from the top whose width is the head's width. */
		headWidthBand: z.number().gt(0).lt(1).default(0.33),
		/** Share of the figure's height from the top that is the head. */
		headHeightBand: z.number().gt(0).lt(1).default(0.3),
		/** Pixels added around the head box on the still. */
		margin: z.int().min(0).default(3),
		/** Pixels of background around each sprite, so the head can be matched at its edge. */
		border: z.int().min(0).default(12),
		/** The scales from still to sprite that are tried, from, to (excluded) and in steps of. */
		scaleFrom: z.number().positive().default(0.32),
		scaleTo: z.number().positive().default(0.38),
		scaleStep: z.number().positive().default(0.0025),
		/** The ear may stray from the head by at most this many sprite pixels in any frame, or the face would slide. */
		earLimit: z.number().positive().default(1),
	})
	.refine((v) => v.scaleTo > v.scaleFrom, 'the scale search runs upwards');

export type HeadTrackConfig = z.infer<typeof headTrackConfigSchema>;
