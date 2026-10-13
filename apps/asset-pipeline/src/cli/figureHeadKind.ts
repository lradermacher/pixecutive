// figureHeadKind.ts — the figure, head-part kind and number a head-part command names, with their specs.
import { FigureException, FigureExceptionKey, type FiguresSpec, HeadPartKind } from '@pixecutive/core';
import { z } from 'zod';
import { type FigureHead, figureHead, type HeadSpec } from './figureHead.ts';

/** One kind's spec, as the data file holds it. */
type KindSpec = NonNullable<HeadSpec['kinds'][HeadPartKind]>;

/** The named figure with its head spec, the kind with its spec, and the number after it. */
export interface FigureHeadKind extends FigureHead {
	readonly kind: HeadPartKind;
	readonly kindSpec: KindSpec;
	readonly number: number;
}

const invalid = (detail: string): FigureException => new FigureException(FigureExceptionKey.InvalidJob, detail);

/**
 * Reads `<figure> <kind> <number>` from the arguments: the number is a drawing's place in the kind's list or a
 * variant's id, as the command says.
 * @throws {FigureException} the invalid job key for an unknown figure or kind, one the data file does not hold, or a
 * number that is no positive whole number.
 */
export function figureHeadKind(args: readonly string[], figures: FiguresSpec): FigureHeadKind {
	const { figure, head } = figureHead(args, figures);
	const kind = z.enum(HeadPartKind).safeParse(args[1]);
	const number = z.coerce.number().int().min(1).safeParse(args[2]);
	if (!kind.success || !number.success) {
		throw invalid(`expected <figure> <kind> <number>, the kind one of ${Object.values(HeadPartKind).join('|')}`);
	}
	const kindSpec = head.kinds[kind.data];
	if (!kindSpec) throw invalid(`the data file holds no ${kind.data} of ${figure}`);
	return { figure, head, kind: kind.data, kindSpec, number: number.data };
}
