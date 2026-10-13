// figureConfig.ts — the motion chain's configuration: paths from the environment, then what the machine offers; the
// figures' specs from the data file; the values every step uses. Parsed once at the start.
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
	type FrameCutConfig,
	frameCutConfigSchema,
	type HeadTrackConfig,
	headTrackConfigSchema,
	type IRenderMachine,
} from '@pixecutive/core';
import type { PythonEnvironment } from '@pixecutive/infrastructure';

/** Everything the motion chain's commands need. */
export interface FigureSetup {
	readonly clip: ClipConfig;
	/** Where the figures' stills and face parts lie (not in the repo: images live only in the office's asset folder). */
	readonly sources: string;
	/** `apps/office-ui/assets/figures` of the repo. */
	readonly assets: string;
	/** Where the commands leave their work for the next one. */
	readonly work: string;
	/** `apps/asset-pipeline/data`: the figures' specs and the prompts. */
	readonly data: string;
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
	uv: 'PIX_UV',
	ltxProject: 'PIX_LTX_PROJECT',
	model: 'PIX_LTX_MODEL',
});

/**
 * Parses the configuration once at the start; `env`, `machine` and `read` are passed in so tests set them. None of
 * the values is a secret, so each has a default.
 * @throws {FigureException} the invalid configuration key, each wrong field named with its variable, or the data
 * file's problem.
 */
export function figureConfig(
	env: Readonly<Record<string, string | undefined>>,
	machine: IRenderMachine,
	read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): FigureSetup {
	const repo = machine.repoRoot();
	const rendersDir = env['PIX_RENDERS_DIR'] ?? join(repo, 'renders');
	const clip = clipConfigSchema.safeParse({
		rendersDir,
		uv: env['PIX_UV'] ?? 'uv',
		ltxProject: env['PIX_LTX_PROJECT'] ?? join(env['HOME'] ?? homedir(), 'deps', 'ltx-2-mlx'),
		model: env['PIX_LTX_MODEL'] ?? machine.cachedVideoModel() ?? '',
	});
	if (!clip.success) {
		const fields = clip.error.issues.map((issue) => {
			const field = issue.path.join('.');
			return `${field}${field in variableOf ? ` (${variableOf[field] ?? ''})` : ''}: ${issue.message}`;
		});
		throw new FigureException(FigureExceptionKey.InvalidConfig, fields.join('; '));
	}
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
		clip: clip.data,
		sources: env['PIX_FIGURE_SOURCES'] ?? join(rendersDir, 'figures'),
		assets: join(repo, 'apps', 'office-ui', 'assets', 'figures'),
		work: join(rendersDir, 'work'),
		data,
		python: { uv: clip.data.uv, project: join(repo, 'packages', 'infrastructure') },
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
