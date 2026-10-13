// headPartsSpec.schema.ts — a figure's head parts: the green stills they are drawn on, the grids that put several
// drawings into one image, and per kind the variants, how they are drawn and the hats open on top. Images are named
// relative to the figure sources folder, prompts relative to the data folder.
import { z } from 'zod';
import { FigureName } from './figureName.enum.ts';
import { gridLayoutSchema } from './gridLayout.schema.ts';
import { HeadPartKind } from './headPartKind.enum.ts';

const png = z.string().endsWith('.png');
const txt = z.string().endsWith('.txt');
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

/**
 * One call of the image model: its prompt, with `{name}` filled from `fill`, the grid it draws in (none: one variant
 * on the still its kind is drawn on), and the variants it draws, cell by cell.
 */
const drawSpecSchema = z.object({
	prompt: txt,
	grid: z.string().min(1).optional(),
	ids,
	fill: z.record(z.string().regex(/^[a-z]+$/), z.string().min(1)).optional(),
});

/** A grid and the still whose box it shows. */
const gridSpecSchema = gridLayoutSchema.extend({ still: png });

/** One kind: its variants, those kept but not offered, its drawings, hats open on top, the hat hair is fitted under
 * and by how much that hat shrinks for the drawing, the fit from another figure. */
const kindSpecSchema = z.object({
	ids,
	/** Variants drawn and cut but not offered, such as hair its grid cell clipped. */
	hidden: z.array(id).optional(),
	draws: z.array(drawSpecSchema).optional(),
	/** Hats that show the hair through their top, so they neither hide the head nor rise with the hair. */
	openTop: z.array(id).optional(),
	fittedFrom: fittedFromSchema.optional(),
	hat: id.optional(),
	shrink: z.int().min(1).optional(),
});

/** The head parts of one figure. */
export const headPartsSpecSchema = z
	.object({
		/** The approved still with its skin, on which face variants are aligned and the skull's top is measured. */
		open: png,
		/** The still with every uncovered skin pixel key green, on which hair and beards are drawn. */
		green: png,
		/** Its variant with skin fringes kept at the features, on which glasses are drawn and against which hats are cut. */
		greenAccessory: png,
		/** The green still with the skull's outline green too, on which hats are drawn. */
		greenOpen: png,
		grids: z.record(z.string().min(1), gridSpecSchema),
		kinds: z.partialRecord(z.enum(HeadPartKind), kindSpecSchema),
	})
	.refine(
		(spec) =>
			Object.values(spec.kinds).every((kind) =>
				(kind.draws ?? []).every((draw) => draw.grid === undefined || draw.grid in spec.grids),
			),
		'a drawing draws in a grid the figure defines',
	)
	.refine(
		(spec) =>
			Object.values(spec.kinds).every((kind) => (kind.hidden ?? []).every((hidden) => kind.ids.includes(hidden))),
		'a hidden variant is one of the kind',
	)
	.refine(
		(spec) => (spec.kinds.hat?.openTop ?? []).every((hat) => spec.kinds.hat?.ids.includes(hat)),
		'an open hat is one of the hats',
	)
	.refine(
		(spec) =>
			Object.values(spec.kinds).every((kind) =>
				(kind.draws ?? []).every((draw) => draw.ids.every((drawn) => kind.ids.includes(drawn))),
			),
		'a drawing draws variants of its kind',
	)
	.refine(
		(spec) =>
			Object.values(spec.kinds).every((kind) =>
				(kind.draws ?? []).every((draw) => {
					const grid = draw.grid === undefined ? undefined : spec.grids[draw.grid];
					return draw.ids.length <= (grid === undefined ? 1 : grid.columns * grid.rows);
				}),
			),
		'a drawing draws no more variants than its grid has cells, one without a grid one',
	)
	.refine((spec) => {
		const under = spec.kinds[HeadPartKind.HairUnderHat];
		return under === undefined || (under.hat !== undefined && under.shrink !== undefined);
	}, 'hair under a hat names its hat and how far that hat shrinks for the drawing')
	.refine(
		(spec) =>
			Object.values(HeadPartKind).every((kind) => kind === HeadPartKind.Hat || spec.kinds[kind]?.openTop === undefined),
		'only a hat is open on top',
	);

export type HeadPartsSpec = z.infer<typeof headPartsSpecSchema>;
