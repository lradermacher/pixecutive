// figurePaths.schema.ts — the folders and the uv command every command of the motion chain needs, parsed at the
// app's start whether or not the command renders a clip.
import { z } from 'zod';

const path = z.string().min(1);

/** The renders folder, the figure sources folder and the uv command. */
export const figurePathsSchema = z.object({
	rendersDir: path,
	sources: path,
	uv: path,
});

export type FigurePaths = z.infer<typeof figurePathsSchema>;
