import { FigureName, HeadPartKind } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { headPaths } from './headPaths.ts';

describe('headPaths', () => {
	it('puts grids, drawings, stills, inputs and layers of a figure under renders/head/<figure>', () => {
		const paths = headPaths('/r', FigureName.F);
		expect([
			paths.grid('tall'),
			paths.drawing(HeadPartKind.Hair, 2),
			paths.still(HeadPartKind.Hat, 4),
			paths.underHatInput(7),
			paths.layer(HeadPartKind.HairUnderHat, 7),
			paths.hide(4),
		]).toEqual([
			'/r/head/f/grid-tall.png',
			'/r/head/f/hair/drawing-2.png',
			'/r/head/f/hat/4.png',
			'/r/head/f/hair-under-hat/input-7.png',
			'/r/head/f/layers/hair-under-hat-7.png',
			'/r/head/f/layers/hat-4-hide.png',
		]);
	});
});
