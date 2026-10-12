// renderImageCommand.ts — the input of the use case "render one image", as a caller hands it in.

/** What the caller asks to render; nothing in it is checked until the use case parses it into a render job. */
export interface RenderImageCommand {
	readonly promptFile: string;
	readonly inputImage: string;
	readonly seed: number;
	readonly width: number;
	readonly height: number;
}
