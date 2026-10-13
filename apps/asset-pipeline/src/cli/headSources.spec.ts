import { FigureException, FigureExceptionKey, FigureName, type FiguresSpec } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { headSources } from './headSources.ts';

const head = {
	open: 'm/open.png',
	green: 'm/g.png',
	greenAccessory: 'm/a.png',
	greenOpen: 'm/o.png',
	grids: {},
	kinds: {},
};
const face = {
	blank: { image: 'm/blank2.png', mask: 'm/blank2_mask.png' },
	brows: { image: 'm/part_brows.png' },
	eyes: { image: 'm/part_eyes.png' },
	mouth: { image: 'm/part_mouth.png' },
};
const figures = {
	m: { ear: { left: 1, top: 1, right: 2, bottom: 2 }, face, head, motions: {} },
} as unknown as FiguresSpec;

describe('headSources', () => {
	it('names the head stills, the blank head, its mask and the default face parts the face spec holds', () => {
		expect(headSources('/src', figures, FigureName.M, head)).toEqual({
			open: '/src/m/open.png',
			green: '/src/m/g.png',
			greenAccessory: '/src/m/a.png',
			greenOpen: '/src/m/o.png',
			blank: '/src/m/blank2.png',
			mask: '/src/m/blank2_mask.png',
			defaults: { brows: '/src/m/part_brows.png', eyes: '/src/m/part_eyes.png', mouth: '/src/m/part_mouth.png' },
		});
	});

	it('refuses a face spec without the blank head mask', () => {
		const bare = { m: { ...figures.m, face: {} } } as unknown as FiguresSpec;
		const failure = ((): unknown => {
			try {
				headSources('/src', bare, FigureName.M, head);
				return null;
			} catch (thrown) {
				return thrown;
			}
		})();
		expect(failure instanceof FigureException && failure.key).toBe(FigureExceptionKey.InvalidConfig);
	});
});
