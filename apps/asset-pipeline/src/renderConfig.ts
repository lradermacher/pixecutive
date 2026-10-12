// renderConfig.ts — the render configuration: the environment first, then what the machine offers, parsed once.
import { join } from 'node:path';
import {
	type IRenderMachine,
	type RenderConfig,
	renderConfigSchema,
	RenderException,
	RenderExceptionKey,
} from '@pixecutive/core';

/** The environment variable that sets each field, so a message can name what to set. */
const variableOf: Readonly<Record<keyof RenderConfig, string>> = Object.freeze({
	rendersDir: 'PIX_RENDERS_DIR',
	modelCommand: 'PIX_MFLUX',
	weights: 'PIX_LORA',
});

/** `~` and `$NAME` or `${NAME}` resolved from `env`, as the Hugging Face hub does; an unknown name stays as written. */
function expandPath(path: string, env: Readonly<Record<string, string | undefined>>): string {
	const home = path === '~' || path.startsWith('~/') ? `${env['HOME'] ?? '~'}${path.slice(1)}` : path;
	return home.replace(
		/\$\{(\w+)\}|\$(\w+)/g,
		(written, braced?: string, plain?: string) => env[braced ?? plain ?? ''] ?? written,
	);
}

/**
 * The Hugging Face cache this machine uses, in the order the Hugging Face hub reads its variables; none when only the
 * usual cache of the home folder applies.
 */
function huggingFaceCache(env: Readonly<Record<string, string | undefined>>): string | undefined {
	const xdg = env['XDG_CACHE_HOME'];
	const named = env['HF_HOME'] ?? (xdg === undefined ? undefined : join(xdg, 'huggingface'));
	// The hub expands its home folder first and the cache path built from it again, so a variable may name another.
	const home = named === undefined ? undefined : expandPath(named, env);
	const cache =
		env['HF_HUB_CACHE'] ?? env['HUGGINGFACE_HUB_CACHE'] ?? (home === undefined ? undefined : join(home, 'hub'));
	return cache === undefined ? undefined : expandPath(cache, env);
}

/** One line per field: what is wrong with it and which variable sets it. */
function fieldLine(field: string, problem: string): string {
	const variable = field in variableOf ? ` (${variableOf[field as keyof RenderConfig]})` : '';
	return `${field}${variable}: ${problem}`;
}

/**
 * Parses the configuration once at the start; `env` and `machine` are passed in so tests set them. None of the values
 * is a secret, so each has a default; a value that is missing or a path that is no file stops the start.
 * @throws {RenderException} with the invalid configuration key, each wrong field named with its variable.
 */
export function renderConfig(env: Readonly<Record<string, string | undefined>>, machine: IRenderMachine): RenderConfig {
	const parsed = renderConfigSchema.safeParse({
		rendersDir: env[variableOf.rendersDir] ?? join(machine.repoRoot(), 'renders'),
		modelCommand: env[variableOf.modelCommand] ?? machine.usualModelCommand(),
		weights: env[variableOf.weights] ?? machine.cachedWeights(huggingFaceCache(env)),
	});
	if (!parsed.success) {
		const fields = parsed.error.issues.map((issue) => fieldLine(issue.path.join('.'), issue.message));
		throw new RenderException(RenderExceptionKey.InvalidConfig, fields.join('; '));
	}
	const missing = Object.entries({ modelCommand: parsed.data.modelCommand, weights: parsed.data.weights })
		.filter(([, path]) => !machine.isFile(path))
		.map(([field, path]) => fieldLine(field, `${path} is no file`));
	if (missing.length > 0) throw new RenderException(RenderExceptionKey.InvalidConfig, missing.join('; '));
	return parsed.data;
}
