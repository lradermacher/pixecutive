// designLine.schema.ts — the office pixel style as data: each choice with its value and where it was decided.
import { z } from 'zod';

/** One choice of the design line, such as the outline or the pixel grid. */
const designChoiceSchema = z.object({ key: z.string().min(1), value: z.string().min(1), source: z.string().min(1) });

/** The design line: every style choice that a reference and a rebuilt asset must follow. */
export const designLineSchema = z.object({ choices: z.array(designChoiceSchema).min(1) });

export type DesignChoice = z.infer<typeof designChoiceSchema>;
export type DesignLine = z.infer<typeof designLineSchema>;
