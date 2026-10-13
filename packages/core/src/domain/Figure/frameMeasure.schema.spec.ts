import { describe, expect, it } from 'vitest';
import { frameMeasureSchema } from './frameMeasure.schema.ts';

const measure = { top: 84, bottom: 684, left: 140, right: 330, legSpread: 96.5, headCenterX: 241.2, change: 4.1 };

describe('frameMeasureSchema', () => {
	it('accepts a measured frame', () => {
		expect(frameMeasureSchema.parse(measure)).toEqual(measure);
	});

	it.each([
		['a box that ends above its top', { ...measure, bottom: 80 }],
		['a box that ends left of its start', { ...measure, right: 100 }],
		['a negative spread', { ...measure, legSpread: -1 }],
		['a negative change', { ...measure, change: -0.1 }],
		['a row that is no integer', { ...measure, top: 84.5 }],
	])('refuses %s', (_, invalid) => {
		expect(frameMeasureSchema.safeParse(invalid).success).toBe(false);
	});
});
