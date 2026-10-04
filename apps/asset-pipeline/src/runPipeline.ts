// runPipeline.ts — the asset pipeline's commands: wires the adapters to the core and translates its exceptions.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { AssetException, ReferenceDevelopmentService } from '@pixecutive/core';
import {
	BlenderReferenceCutoutAdapter,
	JsonlVerdictLogAdapter,
	OllamaVisionCheckerAdapter,
	QwenReferenceRendererAdapter,
	readMemory,
	SystemClockAdapter,
} from '@pixecutive/infrastructure';
import { cutoutCommand } from './command/cutoutCommand.ts';
import { referenceCommand } from './command/referenceCommand.ts';
import { statusCommand } from './command/statusCommand.ts';
import { loadAssetData } from './load-asset-data.ts';
import { pipelineConfig, type PipelineConfig } from './pipelineConfig.ts';

/** Where the command line writes; tests pass collectors. */
export interface PipelineOutput {
	write(text: string): void;
}

/**
 * Runs one command (`reference <figure> [--dry]`, `cutout <figure> <image>`, `status <figure>`) and answers the exit code:
 * 0 done, 2 an asset failure with its key, 1 anything else.
 */
export async function runPipeline(
	argv: readonly string[],
	env: Readonly<Record<string, string | undefined>>,
	out: PipelineOutput,
	err: PipelineOutput,
): Promise<number> {
	const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
	const config = pipelineConfig(env, repoRoot);
	const [command = '', figure = '', ...rest] = argv;
	const clock = new SystemClockAdapter();
	try {
		const lines = await dispatch(command, figure, rest, config, clock);
		out.write(`${lines.join('\n')}\n`);
		return 0;
	} catch (failure) {
		err.write(`${failure instanceof AssetException ? failure.message : String(failure)}\n`);
		return failure instanceof AssetException ? 2 : 1;
	}
}

/** The mflux call: the adapter appends prompt file, input image, seed and output path as $1 to $4. */
function mfluxCommand(config: PipelineConfig, width: number, height: number): string[] {
	const script = [
		`exec "${config.mflux}" --model mlx-community/qwen-image-edit-2511-8bit --base-model qwen-image-edit`,
		`--prompt-file "$1" --image-paths "$2" --seed "$3" --output "$4" --guidance 1.0 --steps 8`,
		`--lora-paths "${config.lora}" --lora-scales 1.0 --no-bake-lora --width ${String(width)} --height ${String(height)}`,
		'--vae-tiling --vae-tile-size 256 --mlx-cache-limit-gb 4',
	].join(' ');
	return ['sh', '-c', script, 'render'];
}

async function dispatch(
	command: string,
	figure: string,
	rest: readonly string[],
	config: PipelineConfig,
	clock: SystemClockAdapter,
): Promise<string[]> {
	if (command === 'status') return statusCommand(join(config.rendersDir, figure), readMemory());
	const data = loadAssetData(config.dataDir);
	if (command === 'cutout') {
		const written = await cutoutCommand(
			data,
			figure,
			rest[0] ?? '',
			config.rendersDir,
			new BlenderReferenceCutoutAdapter(config.blender),
		);
		return [`${String(written.length)} views`, ...written];
	}
	if (command === 'reference') {
		const dry = rest.includes('--dry');
		const renderer = new QwenReferenceRendererAdapter({
			outputDir: join(config.rendersDir, figure),
			command: mfluxCommand(config, data.template.width, data.template.height),
			model: 'qwen-image-edit-2511-8bit',
			steps: 8,
			width: data.template.width,
			height: data.template.height,
			intervalMs: 5000,
			readMemory: (): { pressure: number; swapMb: number } => readMemory(),
			now: (): Date => clock.now(),
		});
		const development = dry
			? null
			: new ReferenceDevelopmentService(
					renderer,
					new OllamaVisionCheckerAdapter(config.ollamaUrl, config.visionModel),
					new JsonlVerdictLogAdapter(join(config.rendersDir, 'verdicts.jsonl')),
					clock,
				);
		const outcome = await referenceCommand(data, figure, development);
		return outcome.verdict === null
			? [outcome.prompt]
			: [`passed: ${outcome.verdict.image} (seed ${String(outcome.verdict.seed)})`];
	}
	return ['usage: main.ts reference <figure> [--dry] · cutout <figure> <image> · status <figure>'];
}
