import { describe, expect, it } from 'vitest';
import { framePlanSchema } from './framePlan.schema.ts';

const plan = {
	sprites: [
		{ source: 13, hold: 2, shiftX: 0, shiftY: 0 },
		{ source: 15, hold: 3, shiftX: -5.01, shiftY: 2 },
	],
	margin: { top: 2, bottom: 0, left: 2, right: 2 },
	height: 200,
	driftPerVideoFrame: 7.49,
};

describe('framePlanSchema', () => {
	it('accepts a plan of grounded sprites with their holds', () => {
		expect(framePlanSchema.parse(plan)).toEqual(plan);
	});

	it.each([
		['a plan without sprites', { ...plan, sprites: [] }],
		['a hold of zero frames', { ...plan, sprites: [{ source: 1, hold: 0, shiftX: 0, shiftY: 0 }] }],
		['a vertical shift that is no whole row', { ...plan, sprites: [{ source: 1, hold: 1, shiftX: 0, shiftY: 0.5 }] }],
		['a negative margin', { ...plan, margin: { top: -1, bottom: 0, left: 2, right: 2 } }],
		['a sprite height below 16', { ...plan, height: 8 }],
	])('refuses %s', (_, invalid) => {
		expect(framePlanSchema.safeParse(invalid).success).toBe(false);
	});
});
