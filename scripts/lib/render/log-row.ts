// log-row.ts — one tab-separated row of the render log, the same columns for a finished and an aborted render.

/** What one render leaves in the log. */
export interface RenderRecord {
	readonly date: string;
	readonly name: string;
	readonly seed: number;
	readonly model: string;
	readonly steps: number;
	readonly size: string;
	readonly firstStepSeconds: number | null;
	readonly totalSeconds: number;
	readonly secondsPerStep: number | null;
	readonly peakPressure: number;
	readonly swapPeakMb: number;
	readonly result: string;
}

/** Formats a record as one log row; a value that was never measured is written as a dash. */
export function logRow(record: RenderRecord): string {
	const or = (value: number | null): string => (value === null ? '-' : String(value));
	return [
		record.date,
		`${record.name}·s${String(record.seed)}`,
		record.model,
		String(record.steps),
		record.size,
		`${or(record.firstStepSeconds)} s`,
		`${String(record.totalSeconds)} s`,
		or(record.secondsPerStep),
		String(record.peakPressure),
		`+${String(record.swapPeakMb)} MB`,
		record.result,
	].join('\t');
}
