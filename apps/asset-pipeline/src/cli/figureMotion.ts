// figureMotion.ts — the figure and motion a command names, with their specs from the data file.
import { FigureException, FigureExceptionKey, FigureName, type FiguresSpec, Motion } from '@pixecutive/core';
import { z } from 'zod';

/** A figure's spec and one motion's spec, as the data file holds them. */
type FigureSpec = NonNullable<FiguresSpec[FigureName]>;
type MotionSpec = NonNullable<FigureSpec['motions'][Motion]>;

/** The named figure and motion with their specs. */
export interface FigureMotion {
	readonly figure: FigureName;
	readonly motion: Motion;
	readonly figureSpec: FigureSpec;
	readonly motionSpec: MotionSpec;
}

/**
 * Reads `<figure> <motion>` from the arguments and finds both in the specs.
 * @throws {FigureException} the invalid job key for an unknown figure or motion, or one the data file does not hold.
 */
export function figureMotion(args: readonly string[], figures: FiguresSpec): FigureMotion {
	const figure = z.enum(FigureName).safeParse(args[0]);
	const motion = z.enum(Motion).safeParse(args[1]);
	if (!figure.success || !motion.success) {
		throw new FigureException(
			FigureExceptionKey.InvalidJob,
			`expected <figure> <motion>, one of ${Object.values(FigureName).join('|')} and ${Object.values(Motion).join('|')}`,
		);
	}
	const figureSpec = figures[figure.data];
	const motionSpec = figureSpec?.motions[motion.data];
	if (!figureSpec || !motionSpec) {
		throw new FigureException(FigureExceptionKey.InvalidJob, `the data file holds no ${figure.data} ${motion.data}`);
	}
	return { figure: figure.data, motion: motion.data, figureSpec, motionSpec };
}
