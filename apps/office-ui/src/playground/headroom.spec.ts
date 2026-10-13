import { describe, expect, it } from 'vitest';
import { headroom } from './headroom.ts';
import type { ManifestMotion } from './manifestMotion.interface.ts';

const motion = (parts: unknown): ManifestMotion =>
	({
		frames: [
			{ file: 'a.png', hold: 1 },
			{ file: 'b.png', hold: 1 },
		],
		width: 90,
		height: 200,
		advance: 0,
		head: {
			scale: 0.5,
			origin: [
				[20, 10],
				[22, 8],
			],
		},
		face: {},
		parts,
	}) as unknown as ManifestMotion;

describe('headroom', () => {
	it('needs none for a motion without head parts or with parts inside the sprite', () => {
		expect([
			headroom(motion(undefined)),
			headroom(motion({ hair: { '1': { file: 'h.png', x: 0, y: 0, width: 30, height: 20 } } })),
		]).toEqual([
			{ top: 0, left: 0, right: 0 },
			{ top: 0, left: 0, right: 0 },
		]);
	});

	it('reaches as far as the farthest frame: long hair past the left and right edges', () => {
		const hair = { hair: { '1': { file: 'h.png', x: -25.5, y: 0, width: 100, height: 20 } } };
		expect(headroom(motion(hair))).toEqual({ top: 0, left: 6, right: 7 });
	});

	it('counts a hat as raised by the most lift and grown with it', () => {
		const hat = { hat: { '4': { file: 'c.png', x: 0, y: -10, width: 30, height: 30 } } };
		expect(headroom(motion(hat))).toEqual({ top: 17, left: 0, right: 0 });
	});
});
