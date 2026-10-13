// exportConfig.schema.ts — the values that turn sprites and face parts into office assets, each with the default the
// shipped base figures were made with. Parsed at the app's start; a test pins them.
import { z } from 'zod';

const pixels = z.int().min(0);
const channelSum = z.int().min(0).max(765);

/** How the edge of a sprite is freed of the light background it was cut on. */
const edgeSchema = z.object({
	/** The background color the clips were rendered on (RGB). */
	background: z
		.tuple([z.int().min(0).max(255), z.int().min(0).max(255), z.int().min(0).max(255)])
		.default([186, 212, 226]),
	/** Distance from the outside from which an opaque pixel counts as the inside. */
	innerDepth: pixels.default(3),
	/** Reach of the outline color an edge pixel is separated from the background with. */
	outlineReach: pixels.default(3),
	/** Distance from the outside within which a pixel is edge. */
	edgeDepth: pixels.default(3),
	/** Distance to the inside within which an edge pixel is separated from the background. */
	innerReach: pixels.default(4),
	/** Share of the outline's distance from the background below which an edge pixel is mixed. */
	mixShare: z.number().gt(0).lt(1).default(0.9),
	/** Channel sum below which an outline color is dark enough to separate an edge pixel with. */
	darkSum: channelSum.default(600),
	/** Distance from the background below which a pixel near the outside is a loose bit of it. */
	looseDistance: channelSum.default(70),
	/** Distance from the outside within which loose bits are dropped. */
	looseDepth: pixels.default(6),
	/** Channel sum below which an opaque pixel is outline. */
	outlineSum: channelSum.default(200),
	/** Channel sum below which a pixel can carry the background's blue cast. */
	castSum: channelSum.default(450),
	/** How much bluer than red a cast pixel is. */
	castBlue: z.int().min(0).max(255).default(10),
	/** Distance from the outside within which the cast is removed. */
	castDepth: pixels.default(4),
	/** How much bluer than red an outline pixel may be and still count as clean. */
	cleanBlue: z.int().min(0).max(255).default(5),
});

/** How a face part is cut from the still and where the blank head's soft edge lies. */
const faceSchema = z.object({
	/** Widening of the blank head's mask (px, odd). */
	blankDilate: z.int().min(1).default(7),
	/** Softening of the widened mask (Gaussian sigma, px). */
	blankBlur: z.number().positive().default(2),
	/** Alpha above which a part pixel belongs to the part. */
	alphaFloor: z.int().min(0).max(255).default(3),
	/** Margin before and after the part's pixels when it is cropped (px). */
	cropBefore: pixels.default(2),
	cropAfter: pixels.default(3),
});

/** The edge clean-up of sprites and the cutting of face parts. */
export const exportConfigSchema = z.object({
	edge: edgeSchema.default(edgeSchema.parse({})),
	face: faceSchema.default(faceSchema.parse({})),
});

export type ExportConfig = z.infer<typeof exportConfigSchema>;
