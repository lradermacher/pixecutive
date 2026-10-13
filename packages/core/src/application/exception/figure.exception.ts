// figure.exception.ts — the framework-free exception of the motion chain: a stable key plus a detail for the log.
import type { FigureExceptionKey } from './figureExceptionKey.enum.ts';

/** A failure of the motion chain. Each edge maps the key to its own answer; the detail says what was measured. */
export class FigureException extends Error {
	constructor(
		public readonly key: FigureExceptionKey,
		public readonly detail: string,
	) {
		super(`${key}: ${detail}`);
		this.name = 'FigureException';
	}
}
