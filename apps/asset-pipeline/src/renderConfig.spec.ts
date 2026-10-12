import { join } from 'node:path';
import { type IRenderMachine, RenderException, RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { renderConfig } from './renderConfig.ts';

/** A machine with the repo at /repo, mflux and a cached LoRA where it usually is, and only `files` on its disk. */
class InMemoryRenderMachine implements IRenderMachine {
	constructor(private readonly files: readonly string[] = ['/opt/tools/mflux', '/hub/lightning.safetensors']) {}

	repoRoot(): string {
		return '/repo';
	}

	usualModelCommand(): string {
		return '/opt/tools/mflux';
	}

	cachedWeights(cache?: string): string | undefined {
		// The cache path as it arrives, not normalized, so a test sees exactly which path the configuration built.
		return cache === undefined ? '/hub/lightning.safetensors' : `${cache}/lightning.safetensors`;
	}

	isFile(path: string): boolean {
		return this.files.includes(path);
	}
}

/** The key `renderConfig` stops with, or null when it starts. */
function stopKey(env: Record<string, string>, machine: IRenderMachine): RenderExceptionKey | null {
	try {
		renderConfig(env, machine);
		return null;
	} catch (failure) {
		return failure instanceof RenderException ? failure.key : null;
	}
}

describe('renderConfig', () => {
	it.each([
		['HF_HUB_CACHE', { HF_HUB_CACHE: '/cache/hub' }, '/cache/hub'],
		['HF_HOME', { HF_HOME: '/cache/hf' }, '/cache/hf/hub'],
		['XDG_CACHE_HOME', { XDG_CACHE_HOME: '/cache/xdg' }, '/cache/xdg/huggingface/hub'],
		['HF_HUB_CACHE over HF_HOME', { HF_HUB_CACHE: '/cache/hub', HF_HOME: '/cache/hf' }, '/cache/hub'],
		['HUGGINGFACE_HUB_CACHE', { HUGGINGFACE_HUB_CACHE: '/cache/legacy' }, '/cache/legacy'],
		['HF_HOME over XDG_CACHE_HOME', { HF_HOME: '/cache/hf', XDG_CACHE_HOME: '/cache/xdg' }, '/cache/hf/hub'],
		['a ~ in HF_HOME', { HF_HOME: '~/hf', HOME: '/opt/someone' }, '/opt/someone/hf/hub'],
		['a variable in HF_HUB_CACHE', { HF_HUB_CACHE: '${VOLUME}/hub', VOLUME: '/volumes/t7' }, '/volumes/t7/hub'],
		[
			'a variable in HF_HOME that holds a ~',
			{ HF_HOME: '$X', X: '~/viaX', HOME: '/opt/someone' },
			'/opt/someone/viaX/hub',
		],
		[
			'a .. in XDG_CACHE_HOME, kept as the hub keeps it',
			{ XDG_CACHE_HOME: '$X/..', X: '/a/b' },
			'/a/b/../huggingface/hub',
		],
		['a name that only the object prototype knows', { HF_HUB_CACHE: '/cache/$constructor' }, '/cache/$constructor'],
		['an empty XDG_CACHE_HOME, as the hub joins it', { XDG_CACHE_HOME: '' }, 'huggingface/hub'],
		[
			'a trailing slash in XDG_CACHE_HOME, joined without a second one',
			{ XDG_CACHE_HOME: '/x/' },
			'/x/huggingface/hub',
		],
		['a .. inside the variable HF_HOME names', { HF_HOME: '$X', X: '/a/b/..' }, '/a/b/../hub'],
	])('looks for the weights in the cache that %s names', (_, env, cache) => {
		const weights = `${cache}/lightning.safetensors`;
		expect(renderConfig(env, new InMemoryRenderMachine(['/opt/tools/mflux', weights])).weights).toBe(weights);
	});

	it('names the variable to set when the weights are missing', () => {
		const failure: unknown = ((): unknown => {
			try {
				return renderConfig({}, new InMemoryRenderMachine(['/opt/tools/mflux']));
			} catch (error) {
				return error;
			}
		})();
		expect(failure instanceof RenderException && failure.detail).toContain('weights (PIX_LORA)');
	});

	it('takes the renders folder, mflux and the LoRA from the machine by default', () => {
		expect(renderConfig({}, new InMemoryRenderMachine())).toEqual({
			rendersDir: join('/repo', 'renders'),
			modelCommand: '/opt/tools/mflux',
			weights: '/hub/lightning.safetensors',
		});
	});

	it('lets the environment override every machine path', () => {
		const machine = new InMemoryRenderMachine(['/m', '/l.safetensors']);
		const config = renderConfig({ PIX_RENDERS_DIR: '/tmp/r', PIX_MFLUX: '/m', PIX_LORA: '/l.safetensors' }, machine);
		expect(config).toEqual({ rendersDir: '/tmp/r', modelCommand: '/m', weights: '/l.safetensors' });
	});

	it('stops the start when a path names no weights', () => {
		expect(stopKey({ PIX_LORA: '/hub/missing' }, new InMemoryRenderMachine())).toBe(RenderExceptionKey.InvalidConfig);
	});

	it('stops the start when mflux is not on this machine', () => {
		expect(stopKey({}, new InMemoryRenderMachine(['/hub/lightning.safetensors']))).toBe(
			RenderExceptionKey.InvalidConfig,
		);
	});

	it('stops the start when the LoRA file is not on this machine', () => {
		expect(stopKey({}, new InMemoryRenderMachine(['/opt/tools/mflux']))).toBe(RenderExceptionKey.InvalidConfig);
	});
});
