import { describe, expect, it } from 'vitest';
import { earBoxSchema } from './earBox.schema.ts';

describe('earBoxSchema', () => {
	it('accepts a box with an area', () => {
		const ear = { left: 184, top: 215, right: 216, bottom: 260 };
		expect(earBoxSchema.parse(ear)).toEqual(ear);
	});

	it.each([
		['a box without width', { left: 10, top: 0, right: 10, bottom: 5 }],
		['a box without height', { left: 0, top: 5, right: 10, bottom: 5 }],
		['a negative pixel', { left: -1, top: 0, right: 10, bottom: 5 }],
	])('refuses %s', (_, ear) => {
		expect(earBoxSchema.safeParse(ear).success).toBe(false);
	});
});
