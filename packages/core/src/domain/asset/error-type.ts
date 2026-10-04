// error-type.ts — a known failure of the image model and its countermeasure in the prompt.

/**
 * A failure mode of the image model. `strip` removes phrases that cause it; `forbid` rejects a prompt that still
 * contains a phrase known to cause it.
 */
export interface ErrorType {
	readonly id: string;
	readonly description: string;
	readonly strip: readonly string[];
	readonly forbid: readonly string[];
}
