// verdict.interface.ts — the outcome of checking one rendered reference against its spec.

/** One check of one rendered reference: which features the vision model found missing, empty when it passed. */
export interface Verdict {
	readonly figure: string;
	readonly image: string;
	readonly seed: number;
	readonly attempt: number;
	readonly failures: readonly string[];
	readonly at: Date;
}
