import { describe, expect, it } from 'vitest';
import { Facing } from './facing.enum.ts';
import { tileTransform } from './tileTransform.ts';

/** Where the transform `[a, b, c, d, e, f]` puts the sprite point (x, y). */
const apply = (
	[a, b, c, d, e, f]: [number, number, number, number, number, number],
	x: number,
	y: number,
): [number, number] => [a * x + c * y + e, b * x + d * y + f];

describe('tileTransform', () => {
	it('scales front-left by the zoom', () => {
		expect(apply(tileTransform(89, 2, Facing.FrontLeft), 10, 20)).toEqual([20, 40]);
	});

	it('mirrors front-right about the figure box, so its left edge lands on the right edge', () => {
		const t = tileTransform(89, 2, Facing.FrontRight);
		expect([apply(t, 0, 0), apply(t, 89, 0), apply(t, 10, 20)]).toEqual([
			[178, 0],
			[0, 0],
			[158, 40],
		]);
	});
});
