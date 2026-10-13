import { FigureException, FigureExceptionKey, type FiguresSpec } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { figureHeadKind } from './figureHeadKind.ts';

const hair = { ids: [1, 2] };
const head = {
	open: 'm/open.png',
	green: 'm/g.png',
	greenAccessory: 'm/a.png',
	greenOpen: 'm/o.png',
	grids: {},
	kinds: { hair },
};
const figures = {
	m: { ear: { left: 1, top: 1, right: 2, bottom: 2 }, face: {}, head, motions: {} },
} as unknown as FiguresSpec;

describe('figureHeadKind', () => {
	it('finds the figure, the kind with its spec and the number', () => {
		expect(figureHeadKind(['m', 'hair', '2'], figures)).toEqual({
			figure: 'm',
			head,
			kind: 'hair',
			kindSpec: hair,
			number: 2,
		});
	});

	it.each([
		['an unknown kind', ['m', 'cape', '1']],
		['a kind the figure lacks', ['m', 'hat', '1']],
		['a number that is no positive whole number', ['m', 'hair', '0']],
		['no number', ['m', 'hair']],
	])('refuses %s', (_, args) => {
		const failure = ((): unknown => {
			try {
				figureHeadKind(args, figures);
				return null;
			} catch (thrown) {
				return thrown;
			}
		})();
		expect(failure instanceof FigureException && failure.key).toBe(FigureExceptionKey.InvalidJob);
	});
});
