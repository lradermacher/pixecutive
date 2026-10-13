import { describe, expect, it } from 'vitest';
import { headTrackConfigSchema } from './headTrackConfig.schema.ts';

describe('headTrackConfigSchema', () => {
	it('gives the values the shipped base figures were tracked with', () => {
		expect(headTrackConfigSchema.parse({})).toEqual({
			background: 60,
			headWidthBand: 0.33,
			headHeightBand: 0.3,
			margin: 3,
			border: 12,
			scaleFrom: 0.32,
			scaleTo: 0.38,
			scaleStep: 0.0025,
			earLimit: 2,
			earReach: 8,
		});
	});

	it.each([
		['a scale search that runs downwards', { scaleFrom: 0.4, scaleTo: 0.3 }],
		['a head band of 1', { headHeightBand: 1 }],
		['a negative border', { border: -1 }],
		['an ear limit of 0', { earLimit: 0 }],
		['an ear reach of 1', { earReach: 1 }],
	])('refuses %s', (_, invalid) => {
		expect(headTrackConfigSchema.safeParse(invalid).success).toBe(false);
	});
});
