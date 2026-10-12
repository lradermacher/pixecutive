// runPipeline.ts — the asset pipeline's composition root: parses the configuration, wires the renderer to the core
// and translates every render failure through the exit code table.
import type { EventEmitter } from 'node:events';
import { type IRenderMachine, RenderImageService } from '@pixecutive/core';
import {
	ClockSystemAdapter,
	LocalRendererMfluxAdapter,
	readMemory,
	RenderMachineLocalAdapter,
} from '@pixecutive/infrastructure';
import { exitAnswer } from './cli/exitAnswer.ts';
import { PipelineCommand } from './cli/pipelineCommand.enum.ts';
import { renderImageHandler } from './cli/renderImage.handler.ts';
import { showRenderStatusHandler } from './cli/showRenderStatus.handler.ts';
import { renderConfig } from './renderConfig.ts';
import { z } from 'zod';

/** Where the command line writes; tests pass collectors. */
export interface PipelineOutput {
	write(text: string): void;
}

/** One reading of the machine's memory, as the guard needs it. */
type MemoryNow = () => { readonly pressure: number; readonly swapMb: number };

/** How often the guard reads the memory while a render runs. */
const guardIntervalMs = 5000;

const usage = 'usage: pnpm assets render <prompt file> <input image> <seed> [<width>x<height>] · pnpm assets status';

/**
 * Runs one command and answers the exit code: 0 done, 2 usage, a render failure's own code from the table, 1 for
 * anything unexpected. `env`, `memoryNow`, `interrupts` and `machine` are passed in so tests set the paths, the memory,
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
		const config = renderConfig(env, machine);
		const service = new RenderImageService(
			new LocalRendererMfluxAdapter({
				...config,
				intervalMs: guardIntervalMs,
				readMemory: memoryNow,
				clock: new ClockSystemAdapter(),
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
