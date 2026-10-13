import { FigureException, FigureExceptionKey, type FiguresSpec } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { figureHead } from './figureHead.ts';

const head = {
	open: 'm/open.png',
	green: 'm/g.png',
	greenAccessory: 'm/a.png',
	greenOpen: 'm/o.png',
	grids: {},
	kinds: {},
};
const figures = {
	m: { ear: { left: 1, top: 1, right: 2, bottom: 2 }, face: {}, head, motions: {} },
} as unknown as FiguresSpec;

describe('figureHead', () => {
	it('finds the named figure and its head parts', () => {
		expect(figureHead(['m'], figures)).toEqual({ figure: 'm', head });
	});

	it.each([
		['an unknown figure', ['x']],
		['a figure without head parts', ['f']],
	])('refuses %s', (_, args) => {
		const failure = ((): unknown => {
			try {
				figureHead(args, figures);
				return null;
			} catch (thrown) {
				return thrown;
			}
		})();
		expect(failure instanceof FigureException && failure.key).toBe(FigureExceptionKey.InvalidJob);
	});
});
