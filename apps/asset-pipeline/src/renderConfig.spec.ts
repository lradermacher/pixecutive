import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RenderException, RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { renderConfig } from './renderConfig.ts';

/** A model binary and a LoRA that exist, in a throwaway folder. */
function machine(): { mflux: string; lora: string } {
	const dir = mkdtempSync(join(tmpdir(), 'config-'));
	const files = { mflux: join(dir, 'mflux'), lora: join(dir, 'lightning.safetensors') };
	writeFileSync(files.mflux, '');
	writeFileSync(files.lora, '');
	return files;
}

/** The key `renderConfig` stops with, or null when it starts. */
function stopKey(env: Record<string, string>): RenderExceptionKey | null {
	try {
		renderConfig(env, '/repo');
		return null;
	} catch (failure) {
		return failure instanceof RenderException ? failure.key : null;
	}
}

describe('renderConfig', () => {
	it('places the renders in the repo by default', () => {
		const { mflux, lora } = machine();
		expect(renderConfig({ PIX_MFLUX: mflux, PIX_LORA: lora }, '/repo').rendersDir).toBe(join('/repo', 'renders'));
	});

	it('lets the environment override every machine path', () => {
		const { mflux, lora } = machine();
		const config = renderConfig({ PIX_RENDERS_DIR: '/tmp/r', PIX_MFLUX: mflux, PIX_LORA: lora }, '/repo');
		expect(config).toEqual({ rendersDir: '/tmp/r', mflux, lora });
	});

	it('stops the start when a path names no weights', () => {
		expect(stopKey({ PIX_MFLUX: machine().mflux, PIX_LORA: '/hub/missing' })).toBe(RenderExceptionKey.InvalidConfig);
	});

	it('stops the start when mflux is not on this machine', () => {
		expect(stopKey({ PIX_MFLUX: '/nope/mflux', PIX_LORA: machine().lora })).toBe(RenderExceptionKey.InvalidConfig);
	});

	it('stops the start when the LoRA file is not on this machine', () => {
		expect(stopKey({ PIX_MFLUX: machine().mflux, PIX_LORA: '/nope/lightning.safetensors' })).toBe(
			RenderExceptionKey.InvalidConfig,
		);
	});
});
