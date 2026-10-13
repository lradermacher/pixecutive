// runPipeline.ts — the asset pipeline's composition root: parses the configuration, wires the renderer to the core
// and translates every render failure through the exit code table.
import type { EventEmitter } from 'node:events';
import { type IRenderMachine, RenderImageService } from '@pixecutive/core';
import { LocalRendererMfluxAdapter, readMemory, RenderMachineLocalAdapter } from '@pixecutive/infrastructure';
import { exitAnswer } from './cli/exitAnswer.ts';
import { PipelineCommand } from './cli/pipelineCommand.enum.ts';
import { renderImageHandler } from './cli/renderImage.handler.ts';
import { showRenderStatusHandler } from './cli/showRenderStatus.handler.ts';
import { renderConfig } from './renderConfig.ts';
import { runFigureCommand } from './runFigureCommand.ts';
import { z } from 'zod';

/** Where the command line writes; tests pass collectors. */
export interface PipelineOutput {
	write(text: string): void;
}

/** One reading of the machine's memory, as the guard needs it. */
type MemoryNow = () => { readonly pressure: number; readonly swapMb: number };

/** How often the guard reads the memory while a render runs. */
const guardIntervalMs = 5000;

const usage =
	'usage: pnpm assets render <prompt file> <input image> <seed> [<width>x<height>] · pnpm assets status · ' +
	'pnpm assets clip|frames|track|export <figure> <motion>';

/**
 * Runs one command and answers the exit code: 0 done, 2 usage, a render or figure failure's own code from its table,
 * 1 for anything unexpected. `env`, `memoryNow`, `interrupts` and `machine` are passed in so tests set the paths, the memory,
 * Ctrl-C and the machine.
 */
export async function runPipeline(
	argv: readonly string[],
	env: Readonly<Record<string, string | undefined>>,
	out: PipelineOutput,
	err: PipelineOutput,
	memoryNow: MemoryNow = () => readMemory(),
	interrupts: EventEmitter = process,
	machine: IRenderMachine = new RenderMachineLocalAdapter(),
): Promise<number> {
	const [command = '', ...args] = argv;
	try {
		const known = z.enum(PipelineCommand).safeParse(command);
		if (!known.success) {
			err.write(`${usage}\n`);
			return 2;
		}
		if (known.data !== PipelineCommand.Render && known.data !== PipelineCommand.Status) {
			const progress = (step: string): void => {
				err.write(`${step}\n`);
			};
			const guard = { readMemory: memoryNow, intervalMs: guardIntervalMs, interrupts, progress };
			return answer(out, await runFigureCommand(known.data, args, env, machine, guard));
		}
		const config = renderConfig(env, machine);
		const service = new RenderImageService(
			new LocalRendererMfluxAdapter({
				rendersDir: config.rendersDir,
				mflux: config.modelCommand,
				lora: config.weights,
				intervalMs: guardIntervalMs,
				readMemory: memoryNow,
				interrupts,
			}),
		);
		if (known.data === PipelineCommand.Status) return answer(out, showRenderStatusHandler(service));
		return answer(out, await renderImageHandler(args, service));
	} catch (failure) {
		const { code, message } = exitAnswer(failure);
		err.write(`${message}\n`);
		return code;
	}
}

function answer(out: PipelineOutput, lines: readonly string[]): number {
	out.write(`${lines.join('\n')}\n`);
	return 0;
}
