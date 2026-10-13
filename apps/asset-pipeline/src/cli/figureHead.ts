// figureHead.ts — the figure a head-part command names, with its head parts from the data file.
import { FigureException, FigureExceptionKey, FigureName, type FiguresSpec } from '@pixecutive/core';
import { z } from 'zod';

/** A figure's head spec, as the data file holds it. */
export type HeadSpec = NonNullable<NonNullable<FiguresSpec[FigureName]>['head']>;

/** The named figure and its head spec. */
export interface FigureHead {
	readonly figure: FigureName;
	readonly head: HeadSpec;
}

/**
 * Reads `<figure>` from the arguments and finds its head parts in the specs.
 * @throws {FigureException} the invalid job key for an unknown figure or one without head parts.
 */
export function figureHead(args: readonly string[], figures: FiguresSpec): FigureHead {
	const figure = z.enum(FigureName).safeParse(args[0]);
	if (!figure.success) {
		throw new FigureException(
			FigureExceptionKey.InvalidJob,
			`expected a figure, one of ${Object.values(FigureName).join('|')}`,
		);
	}
	const head = figures[figure.data]?.head;
	if (!head)
		throw new FigureException(FigureExceptionKey.InvalidJob, `the data file holds no head parts of ${figure.data}`);
	return { figure: figure.data, head };
}
