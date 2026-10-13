// paintHandsCommand.ts — the input of the use case "paint the finger states into a motion's sprites".
import type { HandStates } from '../../domain/Figure/handStates.schema.ts';

/** The sprites a cut wrote with their scale to the still, the still the hands were drawn on, and its hand states. */
export interface PaintHandsCommand {
	readonly frames: readonly string[];
	readonly scale: number;
	readonly still: string;
	readonly hands: HandStates;
}
