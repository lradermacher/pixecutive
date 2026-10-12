import { join } from 'node:path';
import { RenderException, RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { renderConfig } from './renderConfig.ts';

const lora = '/hub/lightning.safetensors';

describe('renderConfig', () => {
	it('places the renders in the repo by default', () => {
		expect(renderConfig({ PIX_LORA: lora }, '/repo').rendersDir).toBe(join('/repo', 'renders'));
	});

	it('lets the environment override every machine path', () => {
		const config = renderConfig({ PIX_RENDERS_DIR: '/tmp/r', PIX_MFLUX: '/m', PIX_LORA: lora }, '/repo');
		expect(config).toEqual({ rendersDir: '/tmp/r', mflux: '/m', lora });
	});

	it('stops the start with the invalid configuration key when a path names no weights', () => {
		const failure: unknown = ((): unknown => {
			try {
				return renderConfig({ PIX_LORA: '/hub/missing' }, '/repo');
			} catch (error) {
				return error;
			}
		})();
		expect(failure instanceof RenderException && failure.key).toBe(RenderExceptionKey.InvalidConfig);
	});
});
