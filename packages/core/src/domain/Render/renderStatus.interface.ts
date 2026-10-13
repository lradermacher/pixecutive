// renderStatus.interface.ts — what the local renderer is doing right now.

/** The running render or none, the machine's memory, and the last rows of the render log. */
export interface RenderStatus {
	readonly running: string | null;
	readonly pressure: number;
	readonly swapMb: number;
	readonly lastRows: readonly string[];
}
