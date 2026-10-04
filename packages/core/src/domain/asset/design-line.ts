// design-line.ts — the office pixel style as data: each choice with its value and where it was decided.

/** One choice of the design line, such as the outline or the pixel grid. */
export interface DesignChoice {
	readonly key: string;
	readonly value: string;
	readonly source: string;
}

/** The design line: every style choice that a reference and a rebuilt asset must follow. */
export interface DesignLine {
	readonly choices: readonly DesignChoice[];
}
