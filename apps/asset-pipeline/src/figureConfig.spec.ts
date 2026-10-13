import { FigureException, FigureExceptionKey, type IRenderMachine } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { figureConfig } from './figureConfig.ts';

/** A machine whose repo lies at /repo and whose cache holds the video model unless told otherwise. */
class InMemoryRenderMachine implements IRenderMachine {
	constructor(private readonly videoModel: string | null = '/hub/ltx') {}

	repoRoot(): string {
		return '/repo';
	}

	usualModelCommand(): string {
		return '/opt/mflux';
	}

	cachedWeights(cache?: string): string | undefined {
		return cache;
	}

	cachedVideoModel(): string | undefined {
		return this.videoModel ?? undefined;
	}

	isFile(path: string): boolean {
		return path !== '';
	}
}

const data = JSON.stringify({ m: { ear: { left: 1, top: 1, right: 9, bottom: 9 }, face: {}, motions: {} } });
const reads: string[] = [];
const read = (path: string): string => {
	reads.push(path);
	return data;
};

function failure(run: () => unknown): string | null {
	try {
		run();
		return null;
	} catch (error) {
		return error instanceof FigureException && error.key === FigureExceptionKey.InvalidConfig ? error.detail : 'other';
	}
}

describe('figureConfig', () => {
	it('builds the paths from the repo and the renders folder, and reads the data file there', () => {
		const setup = figureConfig({ HOME: '/h' }, new InMemoryRenderMachine(), read);
		expect([setup.clip.rendersDir, setup.clip.ltxProject, setup.clip.model]).toEqual([
			'/repo/renders',
			'/h/deps/ltx-2-mlx',
			'/hub/ltx',
		]);
		expect([setup.sources, setup.assets, setup.work]).toEqual([
			'/repo/renders/figures',
			'/repo/apps/office-ui/assets/figures',
			'/repo/renders/work',
		]);
		expect([setup.scripts.frames, setup.python.project]).toEqual([
			'/repo/packages/infrastructure/src/adapter/Frames/frames.py',
			'/repo/packages/infrastructure',
		]);
		expect(reads.at(-1)).toBe('/repo/apps/asset-pipeline/data/figures.json');
		expect([setup.cut.height, setup.track.border, setup.export.edge.innerReach]).toEqual([200, 12, 4]);
	});

	it('takes the environment before the machine', () => {
		const env = { PIX_RENDERS_DIR: '/r', PIX_LTX_MODEL: '/m', PIX_FIGURE_SOURCES: '/s', PIX_UV: '/bin/uv' };
		const setup = figureConfig(env, new InMemoryRenderMachine(), read);
		expect([setup.clip.model, setup.sources, setup.work, setup.python.uv]).toEqual(['/m', '/s', '/r/work', '/bin/uv']);
	});

	it('names the variable to set when the video model is nowhere', () => {
		expect(failure(() => figureConfig({}, new InMemoryRenderMachine(null), read))).toMatch(
			/^model \(PIX_LTX_MODEL\): /,
		);
	});

	it('names the data file when it is no figure spec', () => {
		const detail = failure(() => figureConfig({}, new InMemoryRenderMachine(), () => '{"x": {}}'));
		expect(detail).toMatch(/^\/repo\/apps\/asset-pipeline\/data\/figures\.json: /);
	});
});
