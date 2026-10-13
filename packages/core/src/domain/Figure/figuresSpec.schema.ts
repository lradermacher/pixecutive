// figuresSpec.schema.ts — how each base figure's motions are made: per figure the ear box that checks the head track
// and the face parts on the still, per motion the clip, its cut, the sprites the office uses and the still the head is
// tracked against. Images are named relative to the figure sources folder, prompts relative to the data folder.
import { z } from 'zod';
import { ClipMode } from './clipMode.enum.ts';
import { earBoxSchema } from './earBox.schema.ts';
import { FacePart } from './facePart.enum.ts';
import { FigureName } from './figureName.enum.ts';
import { frameCountSchema } from './frameCount.schema.ts';
import { handStatesSchema } from './handStates.schema.ts';
import { Motion } from './motion.enum.ts';

const png = z.string().endsWith('.png');
const row = z.int().min(0);
const range = z
	.object({ first: row, last: row })
	.refine((r) => r.last >= r.first, 'a range ends where it starts or after');

/** One motion: its clip (mode, frames, strength of the end anchor, prompt, still), its cut and the sprites used. */
const motionSpecSchema = z.object({
	mode: z.enum(ClipMode),
	frames: frameCountSchema,
	endStrength: z.number().min(0).max(1),
	prompt: z.string().endsWith('.txt'),
	still: png,
	/** A loop's range, or a cycle's bounds; a cycle without bounds finds them by the leg spread. */
	range: range.optional(),
	step: z.int().min(1).optional(),
	forward: z.boolean().optional(),
	/** The sprites the office uses, when not all. */
	use: range.optional(),
	/**
	 * The sprite height when not the cut's default: a pose that is not standing (sitting) is lower, so it gets the
	 * height at which its head comes out as large as in the standing motions.
	 */
	height: z.int().min(16).max(1024).optional(),
	/** Drawn finger states painted into the sprites, for a motion whose fingers move. */
	hands: handStatesSchema.optional(),
	/** The still the head is tracked against: the one the face parts were drawn on for this motion. */
	trackStill: png,
});

/** One figure: the ear box on its stills, its face parts and its motions. */
const figureSpecSchema = z.object({
	ear: earBoxSchema,
	face: z.partialRecord(z.enum(FacePart), z.object({ image: png, mask: png.optional() })),
	motions: z.partialRecord(z.enum(Motion), motionSpecSchema),
});

/** Every base figure the pipeline makes. */
export const figuresSpecSchema = z.partialRecord(z.enum(FigureName), figureSpecSchema);

export type FiguresSpec = z.infer<typeof figuresSpecSchema>;
