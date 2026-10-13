// renderImage.handler.ts — `render <prompt file> <input image> <seed> [<width>x<height>]`: one image under the guard.
import {
	type RenderImageCommand,
	type RenderImageService,
	RenderException,
	RenderExceptionKey,
} from '@pixecutive/core';

/** The size the approved figure renders used, when the command names none. */
const defaultSize = '1024x1024';

/** A number written in decimal digits only, so `0x1F`, `1e3` or an empty argument never pass as a seed or a side. */
function digits(text: string): number {
	return /^[0-9]+$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * Turns the command's arguments into a render command and answers the written image; the service checks the values.
 * @throws {RenderException} the invalid job key when the arguments are fewer than three or more than four.
 */
export async function renderImageHandler(args: readonly string[], service: RenderImageService): Promise<string[]> {
	if (args.length < 3 || args.length > 4) {
		throw new RenderException(
			RenderExceptionKey.InvalidJob,
			`expected <prompt file> <input image> <seed> [<width>x<height>], got ${String(args.length)} arguments`,
		);
	}
	const [promptFile = '', inputImage = '', seed = '', size = defaultSize] = args;
	const sides = /^([0-9]+)x([0-9]+)$/.exec(size);
	const command: RenderImageCommand = {
		promptFile,
		inputImage,
		seed: digits(seed),
		width: digits(sides?.[1] ?? ''),
		height: digits(sides?.[2] ?? ''),
	};
	const result = await service.render(command);
	return [`done ${result.name}`, result.image];
}
