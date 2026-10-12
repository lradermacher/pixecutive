// runPipeline.ts — the asset pipeline's commands: wires the adapters to the core and answers an exit code.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readMemory } from '@pixecutive/infrastructure';
import { statusCommand } from './command/statusCommand.ts';
import { pipelineConfig } from './pipelineConfig.ts';

/** Where the command line writes; tests pass collectors. */
export interface PipelineOutput {
	write(text: string): void;
}

/** Runs one command (`status <figure>`) and answers the exit code: 0 done, 1 a failure. */
export function runPipeline(
	argv: readonly string[],
	env: Readonly<Record<string, string | undefined>>,
	out: PipelineOutput,
	err: PipelineOutput,
): number {
	const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
	const config = pipelineConfig(env, repoRoot);
	const [command = '', figure = ''] = argv;
	try {
		const lines =
			command === 'status'
				? statusCommand(join(config.rendersDir, figure), readMemory())
				: ['usage: main.ts status <figure>'];
		out.write(`${lines.join('\n')}\n`);
		return 0;
	} catch (failure) {
		err.write(`${String(failure)}\n`);
		return 1;
	}
}
