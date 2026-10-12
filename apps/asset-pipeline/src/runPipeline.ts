// runPipeline.ts — the asset pipeline's composition root: parses the configuration, wires the renderer to the core
// and translates every render failure through the exit code table.
import { execFileSync } from 'node:child_process';
import { RenderException, RenderImageService } from '@pixecutive/core';
import { ClockSystemAdapter, LocalRendererMfluxAdapter, readMemory } from '@pixecutive/infrastructure';
import { renderExitCode } from './cli/renderExitCode.ts';
import { renderImageHandler } from './cli/renderImage.handler.ts';
import { showRenderStatusHandler } from './cli/showRenderStatus.handler.ts';
import { renderConfig } from './renderConfig.ts';

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
 * anything unexpected. `env` and `memoryNow` are passed in so tests set the paths and the memory.
 */
export async function runPipeline(
	argv: readonly string[],
	env: Readonly<Record<string, string | undefined>>,
	out: PipelineOutput,
	err: PipelineOutput,
	memoryNow: MemoryNow = () => readMemory(),
): Promise<number> {
	const [command = '', ...args] = argv;
	try {
		const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
		const config = renderConfig(env, repoRoot);
		const service = new RenderImageService(
			new LocalRendererMfluxAdapter({
				...config,
				intervalMs: guardIntervalMs,
				readMemory: memoryNow,
				clock: new ClockSystemAdapter(),
			}),
		);
		if (command === 'status') return answer(out, showRenderStatusHandler(service));
		if (command === 'render') return answer(out, await renderImageHandler(args, service));
		err.write(`${usage}\n`);
		return 2;
	} catch (failure) {
		if (!(failure instanceof RenderException)) {
			err.write(`${String(failure)}\n`);
			return 1;
		}
		const { code, message } = renderExitCode[failure.key];
		err.write(`${message} (${failure.key}): ${failure.detail}\n`);
		return code;
	}
}

function answer(out: PipelineOutput, lines: readonly string[]): number {
	out.write(`${lines.join('\n')}\n`);
	return 0;
}
