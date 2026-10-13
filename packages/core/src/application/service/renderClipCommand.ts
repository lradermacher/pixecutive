// renderClipCommand.ts — the input of the use case "render one motion clip", as a caller hands it in.

/** What the caller asks to render; nothing in it is checked until the use case parses it into a clip job. */
export interface RenderClipCommand {
	readonly figure: string;
	readonly motion: string;
	readonly mode: string;
	readonly still: string;
	readonly promptFile: string;
	readonly frames: number;
	readonly endStrength: number;
}
