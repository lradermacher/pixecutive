import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FigureException, FigureExceptionKey } from '@pixecutive/core';
import { RenderMachineLocalAdapter } from '@pixecutive/infrastructure';
import { describe, expect, it } from 'vitest';
import { PipelineCommand } from './cli/pipelineCommand.enum.ts';
import { type FigureCommand, runFigureCommand } from './runFigureCommand.ts';

/** A real Python start loads OpenCV; under a full parallel test run that takes longer than 5 s. */
const PYTHON_START_MS = 30_000;
const guard = {
	readMemory: (): { pressure: number; swapMb: number } => ({ pressure: 1, swapMb: 0 }),
	intervalMs: 50,
	interrupts: new EventEmitter(),
	progress: (): void => undefined,
};

/**
 * Runs a command of this repo's data file against empty renders and sources folders, with the video model at
 * `model`; answers the key and detail.
 */
async function failure(
	command: FigureCommand,
	args: string[],
	model = '/hub/ltx',
): Promise<[FigureExceptionKey, string] | null> {
	const renders = mkdtempSync(join(tmpdir(), 'figure-command-'));
	const env = { PIX_RENDERS_DIR: renders, PIX_LTX_MODEL: model, PIX_FIGURE_SOURCES: join(renders, 'none') };
	const error: unknown = await runFigureCommand(command, args, env, new RenderMachineLocalAdapter(), guard).then(
		() => null,
		(caught: unknown) => caught,
	);
	return error instanceof FigureException ? [error.key, error.detail] : null;
}

describe('runFigureCommand', () => {
	it('wires the clip command to the video model, which refuses a still that is not there', async () => {
		const result = await failure(PipelineCommand.Clip, ['m', 'idle']);
		expect(result?.[0]).toBe(FigureExceptionKey.InvalidJob);
		expect(result?.[1]).toMatch(/^still .*\/none\/m\/idle-start\.png does not exist$/);
	});

	it(
		'wires the frames command to the frame adapters, which cannot read a clip that is not there',
		async () => {
			expect((await failure(PipelineCommand.Frames, ['m', 'idle']))?.[0]).toBe(FigureExceptionKey.FramesFailed);
		},
		PYTHON_START_MS,
	);

	it(
		'runs frames on a machine without the video model, which only the clip command needs',
		async () => {
			expect([
				(await failure(PipelineCommand.Frames, ['m', 'idle'], ''))?.[0],
				(await failure(PipelineCommand.Clip, ['m', 'idle'], ''))?.[0],
			]).toEqual([FigureExceptionKey.FramesFailed, FigureExceptionKey.InvalidConfig]);
		},
		PYTHON_START_MS,
	);

	it(
		'wires the frames command of a motion with finger states, which cuts before it paints and so names the missing clip first',
		async () => {
			expect((await failure(PipelineCommand.Frames, ['m', 'type']))?.[0]).toBe(FigureExceptionKey.FramesFailed);
		},
		PYTHON_START_MS,
	);

	it.each<[FigureCommand, string]>([
		[PipelineCommand.Track, 'no cut of m walk: run `pnpm assets frames m walk` first'],
		[PipelineCommand.Export, 'no cut of m walk: run `pnpm assets frames m walk` first'],
	])('wires %s to the work, which names the command to run first', async (command, detail) => {
		expect(await failure(command, ['m', 'walk'])).toEqual([FigureExceptionKey.InvalidJob, detail]);
	});

	it.each<[FigureCommand, string[], string]>([
		[PipelineCommand.Grid, ['m', 'nine'], 'm has no grid nine; it has head, tall, face'],
		[PipelineCommand.Split, ['m', 'hat', '1'], 'm hat has no drawn grid 1'],
		[PipelineCommand.Fit, ['m', 'hair', '1'], 'm hair is not fitted from another figure'],
		[PipelineCommand.HairUnderHat, ['f', '49'], 'f has no hair under a hat 49'],
	])('wires %s to the head parts of this repo data file', async (command, args, detail) => {
		expect(await failure(command, args)).toEqual([FigureExceptionKey.InvalidJob, detail]);
	});

	it(
		'wires draw and cut to the cutter and the editor, which need the sources and the drawing first',
		async () => {
			const [cut, draw] = [
				await failure(PipelineCommand.Cut, ['m', 'glasses', '1']),
				await failure(PipelineCommand.Draw, ['m', 'glasses', '1'], '/hub/ltx'),
			];
			expect([cut?.[0], draw?.[0]]).toEqual([FigureExceptionKey.CutFailed, FigureExceptionKey.DrawFailed]);
		},
		PYTHON_START_MS,
	);

	it(
		'wires export to the part cutter, which measures the lifts once the cut and the track are there',
		async () => {
			const renders = mkdtempSync(join(tmpdir(), 'figure-command-'));
			const work = join(renders, 'work', 'm-walk');
			mkdirSync(work, { recursive: true });
			const plan = {
				sprites: [{ source: 0, hold: 1, shiftX: 0, shiftY: 0 }],
				margin: { top: 0, bottom: 0, left: 0, right: 0 },
				height: 200,
				driftPerVideoFrame: 0,
			};
			writeFileSync(
				join(work, 'cut.json'),
				JSON.stringify({ plan, result: { frames: [join(work, '00.png')], scale: 0.3, width: 90, height: 200 } }),
			);
			writeFileSync(join(work, 'track.json'), JSON.stringify({ scale: 0.345, origin: [[-48, -36]], earOffset: [0] }));
			const env = { PIX_RENDERS_DIR: renders, PIX_FIGURE_SOURCES: join(renders, 'none') };
			const error: unknown = await runFigureCommand(
				PipelineCommand.Export,
				['m', 'walk'],
				env,
				new RenderMachineLocalAdapter(),
				guard,
			).then(
				() => null,
				(caught: unknown) => caught,
			);
			expect(error instanceof FigureException && error.key).toBe(FigureExceptionKey.CutFailed);
		},
		PYTHON_START_MS,
	);
});
