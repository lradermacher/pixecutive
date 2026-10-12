// renderConfig.ts — the render configuration: the environment first, then what the machine offers, parsed once.
import { join } from 'node:path';
import {
	type IRenderMachine,
	type RenderConfig,
	renderConfigSchema,
	RenderException,
	RenderExceptionKey,
} from '@pixecutive/core';

/**
 * Parses the configuration once at the start; `env` and `machine` are passed in so tests set them. None of the values
 * is a secret, so each has a default; a value of the wrong form or a file that does not exist stops the start.
 * @throws {RenderException} with the invalid configuration key, the schema's message or the missing files.
 */
export function renderConfig(env: Readonly<Record<string, string | undefined>>, machine: IRenderMachine): RenderConfig {
	const parsed = renderConfigSchema.safeParse({
		rendersDir: env['PIX_RENDERS_DIR'] ?? join(machine.repoRoot(), 'renders'),
		mflux: env['PIX_MFLUX'] ?? machine.usualMflux(),
		lora: env['PIX_LORA'] ?? machine.cachedLora(),
	});
	if (!parsed.success) {
		const fields = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
		throw new RenderException(RenderExceptionKey.InvalidConfig, fields);
	}
	const missing = Object.entries({ mflux: parsed.data.mflux, lora: parsed.data.lora })
		.filter(([, path]) => !machine.exists(path))
		.map(([field, path]) => `${field}: ${path} does not exist`);
	if (missing.length > 0) throw new RenderException(RenderExceptionKey.InvalidConfig, missing.join('; '));
	return parsed.data;
}
