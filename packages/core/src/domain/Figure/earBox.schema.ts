// earBox.schema.ts — the box around the ear on a figure's still, in the still's pixels: the head tracker checks the
// head's position by it, independently of the head match.
import { type StillBox, stillBoxSchema } from './stillBox.schema.ts';

/** An ear box; it must have an area. */
export const earBoxSchema = stillBoxSchema;

export type EarBox = StillBox;
