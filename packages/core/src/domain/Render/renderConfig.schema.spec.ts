import { describe, expect, it } from 'vitest';
import { renderConfigSchema } from './renderConfig.schema.ts';

const config = { rendersDir: '/repo/renders', modelCommand: '/bin/model', weights: '/hub/weights.safetensors' };

describe('renderConfigSchema', () => {
	it('accepts a configuration that names every path', () => {
		expect(renderConfigSchema.parse(config)).toEqual(config);
	});

	it.each(['rendersDir', 'modelCommand', 'weights'])(
		'refuses a configuration without %s instead of running on',
		(field) => {
			expect(renderConfigSchema.safeParse({ ...config, [field]: undefined }).success).toBe(false);
		},
	);

	it('refuses an empty path', () => {
		expect(renderConfigSchema.safeParse({ ...config, weights: '' }).success).toBe(false);
	});
});
