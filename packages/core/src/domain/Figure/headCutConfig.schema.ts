// headCutConfig.schema.ts — the values that cut a head part out of the image model's drawing, each with the default
// the proof of concept's layers were cut with. Parsed at the app's start; a test pins them, a change is one line.
import { z } from 'zod';

const level = z.int().min(0).max(255);
const sum = z.int().min(0).max(765);
const pixels = z.int().min(0);
const share = z.number().gt(0).lt(1);

/** Where the drawing is searched against the template: scales from, to (included) and step, shifts up to ± and step. */
const searchSchema = z
	.object({
		scaleFrom: z.number().positive(),
		scaleTo: z.number().positive(),
		scaleStep: z.number().positive(),
		shift: z.number().positive(),
		shiftStep: z.number().positive(),
	})
	.refine((s) => s.scaleTo > s.scaleFrom, 'the scale search runs upwards');

/** The search around the coarse result: scales up to ± `scale` and step, shifts up to ± `shift` and step. */
const refineSchema = z.object({
	scale: z.number().positive(),
	scaleStep: z.number().positive(),
	shift: z.number().positive(),
	shiftStep: z.number().positive(),
});

/** Hair, beards and hair under hats: aligned to the figure's lines, separated from the green, soft at the edge. */
const keyCutSchema = z.object({
	coarse: searchSchema.default({ scaleFrom: 0.95, scaleTo: 1.05, scaleStep: 0.01, shift: 8, shiftStep: 2 }),
	fine: refineSchema.default({ scale: 0.01, scaleStep: 0.0025, shift: 2, shiftStep: 0.5 }),
	/** Green above the larger of red and blue by more than this is key. */
	green: level.default(90),
	/** Color distance from the template's background under which a pixel is background. */
	background: level.default(45),
	/** Color change against the template within two pixels above which a pixel was drawn. */
	changed: level.default(55),
	/** Pixels the face features are grown by, so no feature line is taken for hair. */
	features: pixels.default(7),
	/** Opening that keeps only the thick body of the part, in pixels. */
	thickness: pixels.default(5),
	/** The smallest thick piece kept, in pixels, per kind. */
	smallest: z.object({ hair: pixels, beard: pixels, hairUnderHat: pixels }).default({
		hair: 400,
		beard: 40,
		hairUnderHat: 80,
	}),
	/** The least opacity a separated pixel keeps. */
	floor: z.number().min(0).lt(1).default(0.05),
	/** Green is capped at the larger of red and blue plus this. */
	spill: level.default(4),
	/** Holes smaller than this are filled, islands smaller than `islands` dropped, in pixels. */
	holes: pixels.default(40),
	islands: pixels.default(150),
	/** Green excess at which the edge ring is fully transparent. */
	ring: level.default(160),
});

/** Hats: what the hat covers, and the hide that cuts the head away where the hat replaces it. */
const hatCutSchema = z.object({
	background: level.default(45),
	/** Color change within one pixel above which a pixel was drawn. */
	changed: level.default(60),
	/** Green excess under which a drawn pixel is hat. */
	green: level.default(40),
	/** Share of the image height from the top that holds the hat. */
	head: share.default(0.45),
	/** Pieces smaller than this share of the largest are dropped. */
	pieces: share.default(0.02),
	closing: pixels.default(9),
	holes: pixels.default(400),
	ring: level.default(160),
	/** Color distance from the background above which the head shows under the hat. */
	hide: level.default(12),
	/** Rows below the top of the brows the hide may reach, and the hat's growth that bounds it, in pixels. */
	hideReach: pixels.default(75),
	hideGrowth: pixels.default(13),
	/** Pixels the hide is widened by. */
	hideWidth: pixels.default(5),
});

/** Glasses: aligned to the body's lines, the frame and its lenses kept. */
const glassesCutSchema = z.object({
	coarse: searchSchema.default({ scaleFrom: 0.94, scaleTo: 1.06, scaleStep: 0.01, shift: 16, shiftStep: 4 }),
	fine: refineSchema.default({ scale: 0.01, scaleStep: 0.0025, shift: 3, shiftStep: 1 }),
	/** Color change within one pixel above which a pixel was drawn. */
	changed: level.default(70),
	/** Share of the image height from the top below which nothing is glasses. */
	head: share.default(0.55),
	/** The smallest piece kept, in pixels. */
	smallest: pixels.default(40),
	/** A rim pixel is darker than this sum of RGB and changed by more than `rimChange`. */
	rim: sum.default(260),
	rimChange: level.default(25),
	/** Closing that fills the lenses, and the change a lens pixel shows. */
	lenses: pixels.default(9),
	lensChange: level.default(30),
	holes: pixels.default(200),
	/** Green above the larger of red and blue by more than this, and above `spillFloor`, is spill. */
	spill: level.default(15),
	spillFloor: level.default(90),
});

/** Face variants: each drawn pixel goes to the nearest default part. */
const variantCutSchema = z.object({
	coarse: searchSchema.default({ scaleFrom: 0.88, scaleTo: 1.05, scaleStep: 0.01, shift: 24, shiftStep: 3 }),
	fine: refineSchema.default({ scale: 0.008, scaleStep: 0.002, shift: 3, shiftStep: 0.5 }),
	/** Pixels a default part reaches ahead of its own lines. */
	reach: pixels.default(8),
	edge: pixels.default(9),
	/** Darkness that counts as a drawn line. */
	line: sum.default(150),
	/** Change at which a pixel starts to show, and the change over which it becomes opaque. */
	opacityFrom: level.default(45),
	opacityOver: z.int().min(1).max(255).default(90),
});

/** Every value the head-part cuts use. */
export const headCutConfigSchema = z.object({
	key: keyCutSchema.default(keyCutSchema.parse({})),
	hat: hatCutSchema.default(hatCutSchema.parse({})),
	glasses: glassesCutSchema.default(glassesCutSchema.parse({})),
	variant: variantCutSchema.default(variantCutSchema.parse({})),
	/** The summed color distance from the background above which a row of the open still is the skull. */
	skull: sum.default(60),
	/** The most a hat rises above the bald head for the hair under it, in still pixels. */
	lift: pixels.default(30),
});

export type HeadCutConfig = z.infer<typeof headCutConfigSchema>;
