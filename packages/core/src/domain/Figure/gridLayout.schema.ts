// gridLayout.schema.ts — how several drawings of one figure share one image for the image model: the region of the
// still each cell shows, and how many cells the grid image holds across and down.
import { z } from 'zod';
import { stillBoxSchema } from './stillBox.schema.ts';

const size = z.int().min(16).max(4096);
const count = z.int().min(1).max(8);

/** A grid of `columns` × `rows` cells over an image of `width` × `height`; each cell shows `box` of the still. */
export const gridLayoutSchema = z.object({
	columns: count,
	rows: count,
	width: size,
	height: size,
	box: stillBoxSchema,
});

export type GridLayout = z.infer<typeof gridLayoutSchema>;
