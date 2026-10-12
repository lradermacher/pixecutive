// render.exception.ts — the framework-free exception of rendering: a stable key plus a detail for the log.
import type { RenderExceptionKey } from './renderExceptionKey.enum.ts';

/** A render failure. Each edge maps the key to its own answer; the detail says what was measured. */
export class RenderException extends Error {
	constructor(
		public readonly key: RenderExceptionKey,
		public readonly detail: string,
	) {
		super(`${key}: ${detail}`);
		this.name = 'RenderException';
	}
}
