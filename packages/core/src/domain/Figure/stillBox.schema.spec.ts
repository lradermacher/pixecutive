import { describe, expect, it } from 'vitest';
import { stillBoxSchema } from './stillBox.schema.ts';

describe('stillBoxSchema', () => {
	it('accepts a box with an area', () => {
		const box = { left: 420, top: 360, right: 600, bottom: 460 };
		expect(stillBoxSchema.parse(box)).toEqual(box);
	});

	it.each([
		['no width', { left: 10, top: 0, right: 10, bottom: 5 }],
		['no height', { left: 0, top: 5, right: 10, bottom: 5 }],
		['a negative pixel', { left: -1, top: 0, right: 10, bottom: 5 }],
	])('refuses a box with %s', (_, box) => {
		expect(stillBoxSchema.safeParse(box).success).toBe(false);
	});
});
