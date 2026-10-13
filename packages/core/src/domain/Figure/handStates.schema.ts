// handStates.schema.ts — the drawn finger states of a motion whose fingers the video model cannot move without
// melting them: the box of the hands on the motion's still, the state drawings (the still with only the fingers
// changed), and how many sprite frames each state is shown.
import { z } from 'zod';
import { stillBoxSchema } from './stillBox.schema.ts';

/** The hands' box on the still, one drawing per state, and the sprite frames per state. */
export const handStatesSchema = z.object({
	box: stillBoxSchema,
	states: z.array(z.string().endsWith('.png')).min(1),
	ticks: z.int().min(1).default(4),
	/**
	 * Sprite pixels from the last sprite's hands within which the hands are searched, so a like shape elsewhere is
	 * not taken.
	 */
	reach: z.int().min(1).default(6),
});

export type HandStates = z.infer<typeof handStatesSchema>;
