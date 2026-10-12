// renderResult.interface.ts — what a finished render leaves behind.

/** The image a render wrote, and the name its log row carries. */
export interface RenderResult {
	readonly name: string;
	readonly image: string;
}
