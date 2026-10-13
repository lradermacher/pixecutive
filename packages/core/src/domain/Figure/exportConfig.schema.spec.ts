import { describe, expect, it } from 'vitest';
import { exportConfigSchema } from './exportConfig.schema.ts';

describe('exportConfigSchema', () => {
	it('gives the values the shipped base figures were made with', () => {
		expect(exportConfigSchema.parse({})).toEqual({
			edge: {
				background: [186, 212, 226],
				innerDepth: 3,
				outlineReach: 3,
				edgeDepth: 3,
				innerReach: 4,
				mixShare: 0.9,
				darkSum: 600,
				looseDistance: 70,
				looseDepth: 6,
				outlineSum: 200,
				castSum: 450,
				castBlue: 10,
				castDepth: 4,
				cleanBlue: 5,
			},
			face: { blankDilate: 7, blankBlur: 2, alphaFloor: 3, cropBefore: 2, cropAfter: 3 },
		});
	});

	it.each([
		['a background channel above 255', { edge: { background: [186, 212, 300] } }],
		['a mix share of 1', { edge: { mixShare: 1 } }],
		['a blur of zero', { face: { blankBlur: 0 } }],
	])('refuses %s', (_, invalid) => {
		expect(exportConfigSchema.safeParse(invalid).success).toBe(false);
	});
});
