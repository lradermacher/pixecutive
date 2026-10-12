// renderConfig.ts — where the local renderer lives on this machine: the environment first, then the usual places.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type RenderConfig, renderConfigSchema, RenderException, RenderExceptionKey } from '@pixecutive/core';

/** The Lightning LoRA in the Hugging Face cache, whose snapshot folder is named by a hash; none when not downloaded. */
function lightningLora(): string | undefined {
	const snapshots = join(
		homedir(),
		'.cache',
		'huggingface',
		'hub',
		'models--lightx2v--Qwen-Image-Edit-2511-Lightning',
		'snapshots',
	);
	const snapshot = existsSync(snapshots) ? readdirSync(snapshots)[0] : undefined;
	return snapshot === undefined
		? undefined
		: join(snapshots, snapshot, 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors');
}

/**
 * Parses the configuration once at the start; `env` and `repoRoot` are passed in so tests set them. None of the
 * values is a secret, so each has a default, and a value that cannot be found stops the start.
 * @throws {RenderException} with the invalid configuration key and the schema's message.
 */
export function renderConfig(env: Readonly<Record<string, string | undefined>>, repoRoot: string): RenderConfig {
	const parsed = renderConfigSchema.safeParse({
		rendersDir: env['PIX_RENDERS_DIR'] ?? join(repoRoot, 'renders'),
		mflux: env['PIX_MFLUX'] ?? join(homedir(), '.local', 'bin', 'mflux-generate-qwen-edit'),
		lora: env['PIX_LORA'] ?? lightningLora(),
	});
	if (!parsed.success) {
		const fields = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
		throw new RenderException(RenderExceptionKey.InvalidConfig, fields);
	}
	return parsed.data;
}
