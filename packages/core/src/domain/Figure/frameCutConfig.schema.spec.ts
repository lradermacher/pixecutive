import { describe, expect, it } from 'vitest';
import { frameCutConfigSchema } from './frameCutConfig.schema.ts';

describe('frameCutConfigSchema', () => {
	it('gives the values the shipped base figures were cut with', () => {
		expect(frameCutConfigSchema.parse({})).toEqual({
			background: 60,
			inside: 35,
			poseChange: 3,
			legBand: 0.75,
			headBand: 0.3,
			margin: { top: 2, bottom: 0, left: 2, right: 2 },
			height: 200,
		});
	});

	it.each([
		['a background distance of zero', { background: 0 }],
		['a leg band of 1', { legBand: 1 }],
		['a pose change of zero', { poseChange: 0 }],
		['a negative margin', { margin: { top: -1, bottom: 0, left: 2, right: 2 } }],
	])('refuses %s', (_, invalid) => {
		expect(frameCutConfigSchema.safeParse(invalid).success).toBe(false);
	});
});
