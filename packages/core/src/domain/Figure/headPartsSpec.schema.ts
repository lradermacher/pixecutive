// headPartsSpec.schema.ts — a figure's head parts: the green stills they are drawn on, the grids that put several
// drawings into one image, and per kind the variants, the grid it is drawn in and the hats open on top. Images are
// named relative to the figure sources folder.
import { z } from 'zod';
import { FigureName } from './figureName.enum.ts';
import { gridLayoutSchema } from './gridLayout.schema.ts';
import { HeadPartKind } from './headPartKind.enum.ts';

const png = z.string().endsWith('.png');
const id = z.int().min(1);
const ids = z
	.array(id)
	.min(1)
	.refine((list) => new Set(list).size === list.length, 'every variant once');

/** A part made on another figure and fitted to this one: scaled about its centre, then moved. */
const fittedFromSchema = z.object({
	figure: z.enum(FigureName),
	scale: z.number().positive(),
	dx: z.number(),
	dy: z.number(),
});

/** One kind: its variants, the grid it is drawn in (none: one drawing per call), hats open on top, the fit. */
const kindSpecSchema = z.object({
	ids,
	grid: z.string().min(1).optional(),
	/** Hats that show the hair through their top, so they neither hide the head nor rise with the hair. */
	openTop: z.array(id).optional(),
	fittedFrom: fittedFromSchema.optional(),
});

/** The head parts of one figure. */
export const headPartsSpecSchema = z
	.object({
		/** The still with every uncovered skin pixel key green, on which hair, beards and glasses are drawn. */
		green: png,
		/** The green still with the skull's outline green too, on which hats are drawn. */
		greenOpen: png,
		grids: z.record(z.string().min(1), gridLayoutSchema),
		kinds: z.partialRecord(z.enum(HeadPartKind), kindSpecSchema),
	})
	.refine(
		(spec) => Object.values(spec.kinds).every((kind) => kind.grid === undefined || kind.grid in spec.grids),
		'a kind draws in a grid the figure defines',
	)
	.refine(
		(spec) => (spec.kinds.hat?.openTop ?? []).every((hat) => spec.kinds.hat?.ids.includes(hat)),
		'an open hat is one of the hats',
	)
	.refine(
		(spec) =>
			Object.values(HeadPartKind).every((kind) => kind === HeadPartKind.Hat || spec.kinds[kind]?.openTop === undefined),
		'only a hat is open on top',
	);

export type HeadPartsSpec = z.infer<typeof headPartsSpecSchema>;
