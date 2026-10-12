import { describe, expect, it } from 'vitest';
import { renderConfigSchema } from './renderConfig.schema.ts';

const config = { rendersDir: '/repo/renders', mflux: '/bin/mflux', lora: '/hub/lightning.safetensors' };

describe('renderConfigSchema', () => {
	it('accepts a configuration that names every path', () => {
		expect(renderConfigSchema.parse(config)).toEqual(config);
	});

	it('refuses a missing model path instead of running on', () => {
		expect(renderConfigSchema.safeParse({ ...config, mflux: undefined }).success).toBe(false);
	});

	it('refuses a LoRA path that names no weights file', () => {
		expect(renderConfigSchema.safeParse({ ...config, lora: '/hub/missing' }).success).toBe(false);
	});
});
