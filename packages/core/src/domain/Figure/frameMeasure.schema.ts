// frameMeasure.schema.ts — what the frame measurer reports about one video frame, so the core can decide on it.
import { z } from 'zod';

const row = z.int().min(0);

/** One video frame: the figure's box, the spread of its feet, where its head is and how much the frame changed. */
export const frameMeasureSchema = z
	.object({
		top: row,
		bottom: row,
		left: row,
		right: row,
		legSpread: z.number().min(0),
		headCenterX: z.number(),
		change: z.number().min(0),
	})
	.refine((m) => m.bottom >= m.top && m.right >= m.left, 'a box ends where it starts or after');

export type FrameMeasure = z.infer<typeof frameMeasureSchema>;
