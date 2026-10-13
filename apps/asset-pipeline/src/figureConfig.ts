// figureConfig.ts — the motion chain's configuration: paths from the environment, then what the machine offers; the
// figures' specs from the data file; the values every step uses. Parsed once at the start; the video model's part
// only by the clip command, so frames, track and export run on a machine without it.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
	type ClipConfig,
	clipConfigSchema,
	type ExportConfig,
	exportConfigSchema,
	FigureException,
	FigureExceptionKey,
	type FiguresSpec,
	figuresSpecSchema,
	figurePathsSchema,
	type FrameCutConfig,
	frameCutConfigSchema,
	type HeadTrackConfig,
	headTrackConfigSchema,
	type IRenderMachine,
	RenderException,
} from '@pixecutive/core';
import type { PythonEnvironment } from '@pixecutive/infrastructure';

/** Everything the motion chain's commands need. */
export interface FigureSetup {
	/**
	 * Parses where the video model lives; only the clip command needs it. `PIX_LTX_MODEL` sets the weights (default:
	 * the model in the local model cache), `PIX_LTX_PROJECT` the model's checkout (default: `~/deps/ltx-2-mlx`).
	 * @throws {FigureException} the invalid configuration key, each wrong field named with its variable.
	 */
	readonly clip: () => ClipConfig;
	/** The renders folder: clips, work and staged exports. `PIX_RENDERS_DIR`, default `renders` in the repo. */
	readonly rendersDir: string;
	/**
	 * Where the figures' stills and face parts lie (not in the repo: images live only in the office's asset folder).
	 * `PIX_FIGURE_SOURCES`, default `figures` in the renders folder.
	 */
	readonly sources: string;
	/** `apps/office-ui/assets/figures` of the repo. */
	readonly assets: string;
	/** Where the commands leave their work for the next one. */
	readonly work: string;
	/** Where an export is written before it replaces the shipped motion in the asset folder. */
	readonly staging: string;
	/** `apps/asset-pipeline/data`: the figures' specs and the prompts. */
	readonly data: string;
	/** The pixel steps' Python environment; `PIX_UV` names the uv command (default `uv` on the path). */
	readonly python: PythonEnvironment;
	readonly scripts: { readonly frames: string; readonly head: string; readonly assets: string };
	readonly figures: FiguresSpec;
	readonly cut: FrameCutConfig;
	readonly track: HeadTrackConfig;
	readonly export: ExportConfig;
}

/** The environment variable that sets each path of the clip, so a message can name what to set. */
const variableOf: Readonly<Record<string, string>> = Object.freeze({
	rendersDir: 'PIX_RENDERS_DIR',
	sources: 'PIX_FIGURE_SOURCES',
	uv: 'PIX_UV',
	ltxProject: 'PIX_LTX_PROJECT',
	model: 'PIX_LTX_MODEL',
});

/** Names each wrong field with the variable that sets it, as the invalid configuration key. */
function invalid(issues: readonly { path: readonly PropertyKey[]; message: string }[]): FigureException {
	const fields = issues.map((issue) => {
		const field = issue.path.map(String).join('.');
		return `${field}${field in variableOf ? ` (${variableOf[field] ?? ''})` : ''}: ${issue.message}`;
	});
	return new FigureException(FigureExceptionKey.InvalidConfig, fields.join('; '));
}

/**
 * The video model the machine's cache holds, if any.
 * @throws {FigureException} the invalid configuration key when the cache cannot be read.
 */
function cachedVideoModel(machine: IRenderMachine): string | undefined {
	try {
		return machine.cachedVideoModel();
	} catch (failure) {
		if (failure instanceof RenderException) throw new FigureException(FigureExceptionKey.InvalidConfig, failure.detail);
		throw failure;
	}
}

/**
 * Parses the clip's part of the configuration.
 * @throws {FigureException} the invalid configuration key, each wrong field named with its variable, or the
 * unreadable model cache.
 */
function clipConfig(
	env: Readonly<Record<string, string | undefined>>,
	machine: IRenderMachine,
	rendersDir: string,
	uv: string,
): ClipConfig {
	const clip = clipConfigSchema.safeParse({
		rendersDir,
		uv,
		ltxProject: env['PIX_LTX_PROJECT'] ?? join(env['HOME'] ?? homedir(), 'deps', 'ltx-2-mlx'),
		model: env['PIX_LTX_MODEL'] ?? cachedVideoModel(machine) ?? '',
	});
	if (!clip.success) throw invalid(clip.error.issues);
	return clip.data;
}

/**
 * Parses the configuration once at the start; `env`, `machine` and `read` are passed in so tests set them. None of
 * the values is a secret, so each has a default.
 * @throws {FigureException} the invalid configuration key, each wrong path named with its variable, or the data
 * file's problem.
 */
export function figureConfig(
	env: Readonly<Record<string, string | undefined>>,
	machine: IRenderMachine,
	read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): FigureSetup {
	const repo = machine.repoRoot();
	const renders = env['PIX_RENDERS_DIR'] ?? join(repo, 'renders');
	const paths = figurePathsSchema.safeParse({
		rendersDir: renders,
		sources: env['PIX_FIGURE_SOURCES'] ?? join(renders, 'figures'),
		uv: env['PIX_UV'] ?? 'uv',
	});
	if (!paths.success) throw invalid(paths.error.issues);
	const { rendersDir, sources, uv } = paths.data;
	const data = join(repo, 'apps', 'asset-pipeline', 'data');
	const specFile = join(data, 'figures.json');
	let raw: unknown;
	try {
		raw = JSON.parse(read(specFile));
	} catch (failure) {
		throw new FigureException(FigureExceptionKey.InvalidConfig, `${specFile}: ${(failure as Error).message}`);
	}
	const figures = figuresSpecSchema.safeParse(raw);
	if (!figures.success)
		throw new FigureException(FigureExceptionKey.InvalidConfig, `${specFile}: ${figures.error.message}`);
	const adapters = join(repo, 'packages', 'infrastructure', 'src', 'adapter');
	return {
		clip: () => clipConfig(env, machine, rendersDir, uv),
		rendersDir,
		sources,
		assets: join(repo, 'apps', 'office-ui', 'assets', 'figures'),
		work: join(rendersDir, 'work'),
		staging: join(rendersDir, 'export'),
		data,
		python: { uv, project: join(repo, 'packages', 'infrastructure') },
		scripts: {
			frames: join(adapters, 'Frames', 'frames.py'),
			head: join(adapters, 'Head', 'head.py'),
			assets: join(adapters, 'Asset', 'assets.py'),
		},
		figures: figures.data,
		cut: frameCutConfigSchema.parse({}),
		track: headTrackConfigSchema.parse({}),
		export: exportConfigSchema.parse({}),
	};
}
