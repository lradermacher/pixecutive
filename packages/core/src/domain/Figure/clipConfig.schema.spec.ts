import { describe, expect, it } from 'vitest';
import { clipConfigSchema } from './clipConfig.schema.ts';

const machine = { rendersDir: '/r', ltxProject: '/deps/ltx-2-mlx', model: '/hub/ltx-2.3-mlx-q8' };

describe('clipConfigSchema', () => {
	it('gives the settings the shipped clips were rendered with', () => {
		expect(clipConfigSchema.parse(machine)).toEqual({
			...machine,
			uv: 'uv',
			promptSuffix:
				', three-quarter view, plain light blue background, static locked camera, same character in every frame',
			frameRate: 24,
			size: 768,
		});
	});

	it.each([
		['no renders folder', { ...machine, rendersDir: '' }],
		['no model checkout', { ...machine, ltxProject: undefined }],
		['a size off the 32 pixel grid', { ...machine, size: 770 }],
		['a frame rate of zero', { ...machine, frameRate: 0 }],
	])('refuses %s', (_, invalid) => {
		expect(clipConfigSchema.safeParse(invalid).success).toBe(false);
	});
});
