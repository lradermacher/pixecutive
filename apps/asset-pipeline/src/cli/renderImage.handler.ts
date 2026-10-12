// renderImage.handler.ts — `render <prompt file> <input image> <seed> [<width>x<height>]`: one image under the guard.
import type { RenderImageService } from '@pixecutive/core';

/** The size the approved figure renders used, when the command names none. */
const defaultSize = '1024x1024';

/** Turns the command's arguments into a render job and answers the written image; the service checks the job. */
export async function renderImageHandler(args: readonly string[], service: RenderImageService): Promise<string[]> {
	const [promptFile, inputImage, seed, size = defaultSize] = args;
	const [width, height] = size.split('x').map(Number);
	const result = await service.render({ promptFile, inputImage, seed: Number(seed), width, height });
	return [`done ${result.name}`, result.image];
}
