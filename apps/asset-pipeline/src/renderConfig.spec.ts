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

	usualMflux(): string {
		return '/opt/tools/mflux';
	}

	cachedLora(): string | undefined {
		return '/hub/lightning.safetensors';
	}

	exists(path: string): boolean {
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
	it('takes the renders folder, mflux and the LoRA from the machine by default', () => {
		expect(renderConfig({}, new InMemoryRenderMachine())).toEqual({
			rendersDir: join('/repo', 'renders'),
			mflux: '/opt/tools/mflux',
			lora: '/hub/lightning.safetensors',
		});
	});

	it('lets the environment override every machine path', () => {
		const machine = new InMemoryRenderMachine(['/m', '/l.safetensors']);
		const config = renderConfig({ PIX_RENDERS_DIR: '/tmp/r', PIX_MFLUX: '/m', PIX_LORA: '/l.safetensors' }, machine);
		expect(config).toEqual({ rendersDir: '/tmp/r', mflux: '/m', lora: '/l.safetensors' });
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
