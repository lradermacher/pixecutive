// pipelineConfig.ts — where the local tools of this machine live; each path can be overridden by the environment.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The machine-specific paths and endpoints the pipeline wires into its adapters. */
export interface PipelineConfig {
	readonly rendersDir: string;
	readonly mflux: string;
	readonly lora: string;
}

/** The Hugging Face cache names a snapshot by its hash, so the one snapshot folder is looked up. */
function lightningLora(snapshots: string): string {
	const snapshot = existsSync(snapshots) ? readdirSync(snapshots)[0] : undefined;
	return join(snapshots, snapshot ?? 'missing', 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors');
}

/** Reads the configuration once at the start; `env` and `repoRoot` are passed in so tests set them. */
export function pipelineConfig(env: Readonly<Record<string, string | undefined>>, repoRoot: string): PipelineConfig {
	const hub = join(homedir(), '.cache', 'huggingface', 'hub');
	return {
		rendersDir: env['PIX_RENDERS_DIR'] ?? join(repoRoot, 'renders'),
		mflux: env['PIX_MFLUX'] ?? join(homedir(), '.local', 'bin', 'mflux-generate-qwen-edit'),
		lora: env['PIX_LORA'] ?? lightningLora(join(hub, 'models--lightx2v--Qwen-Image-Edit-2511-Lightning', 'snapshots')),
	};
}
