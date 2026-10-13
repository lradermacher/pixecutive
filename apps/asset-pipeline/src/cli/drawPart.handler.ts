// drawPart.handler.ts — `pnpm assets draw <figure> <kind> <drawing>`: one call of the image model, the kind's drawing
// by its place in the data file's list.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FigureException, FigureExceptionKey, HeadPartKind, type MakeHeadPartService } from '@pixecutive/core';
import type { FigureSetup } from '../figureConfig.ts';
import { type FigureHeadKind, figureHeadKind } from './figureHeadKind.ts';
import { headPaths } from './headPaths.ts';

/**
 * The image the model edits and where its drawing lands: a drawing in a grid edits the grid and lands numbered; else
 * the still its kind is drawn on, as the core decides, or for hair under a hat the hairstyle's input, and it lands as
 * the variant's own still, `first` being the variant drawn.
 */
function drawingFiles(
	setup: FigureSetup,
	service: MakeHeadPartService,
	named: FigureHeadKind,
	grid: string | undefined,
	first: number,
): { input: string; output: string } {
	const { figure, head, kind, number } = named;
	const paths = headPaths(setup.rendersDir, figure);
	if (grid !== undefined) return { input: paths.grid(grid), output: paths.drawing(kind, number) };
	const input =
		kind === HeadPartKind.HairUnderHat ? paths.underHatInput(first) : join(setup.sources, service.template(kind, head));
	return { input, output: paths.still(kind, first) };
}

/**
 * Has the model draw the kind's drawing: on its grid when it has one, else on the still its kind is drawn on,
 * and for hair under a hat on that hairstyle's input.
 * @throws {FigureException} the invalid job key for an unknown drawing or a prompt that cannot be read; the editor's
 * keys.
 */
export async function drawPartHandler(
	args: readonly string[],
	setup: FigureSetup,
	service: MakeHeadPartService,
	read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): Promise<string[]> {
	const named = figureHeadKind(args, setup.figures);
	const { figure, kind, kindSpec, number } = named;
	const draw = kindSpec.draws?.[number - 1];
	if (draw === undefined) {
		throw new FigureException(
			FigureExceptionKey.InvalidJob,
			`${figure} ${kind} has ${String(kindSpec.draws?.length ?? 0)} drawings, not ${String(number)}`,
		);
	}
	const { input, output } = drawingFiles(setup, service, named, draw.grid, draw.ids[0] ?? number);
	let prompt: string;
	try {
		prompt = read(join(setup.data, draw.prompt));
	} catch (failure) {
		throw new FigureException(FigureExceptionKey.InvalidJob, `${draw.prompt}: ${(failure as Error).message}`);
	}
	await service.draw({ input, prompt, fill: draw.fill ?? {}, output });
	return [`drew ${figure} ${kind} ${String(number)}: ${output}`];
}
