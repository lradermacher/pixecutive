import { describe, expect, it } from 'vitest';
import { cutResultSchema } from './cutResult.schema.ts';

const result = { frames: ['00.png', '01.png'], scale: 0.3345, width: 94, height: 201 };

describe('cutResultSchema', () => {
	it('accepts sprites with their scale and size', () => {
		expect(cutResultSchema.parse(result)).toEqual(result);
	});

	it.each([
		['no sprites', { ...result, frames: [] }],
		['a sprite that is no PNG', { ...result, frames: ['00.jpg'] }],
		['a scale of zero', { ...result, scale: 0 }],
		['a width that is no whole pixel', { ...result, width: 94.5 }],
	])('refuses %s', (_, invalid) => {
		expect(cutResultSchema.safeParse(invalid).success).toBe(false);
	});
});
