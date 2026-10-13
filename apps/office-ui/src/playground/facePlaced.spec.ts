import { describe, expect, it } from 'vitest';
import { facePlaced } from './facePlaced.ts';
import { fixtureManifest } from './fixtureManifest.ts';

const motions = fixtureManifest.figures['m']?.motions ?? {};

describe('facePlaced', () => {
	it('puts each part at the frame head origin plus its offset, blank head first, eyes open, mouth last', () => {
		const idle = motions['idle'];
		expect(idle && facePlaced('idle', idle, 1)).toEqual([
			{ file: 'm/face/idle/blank.png', x: 34, y: 25, width: 10, height: 8 },
			{ file: 'm/face/idle/eyes.png', x: 40, y: 25, width: 10, height: 8 },
			{ file: 'm/face/idle/mouth.png', x: 49, y: 25, width: 10, height: 8 },
		]);
	});

	it('follows the head from frame to frame', () => {
		const idle = motions['idle'];
		expect(idle && [0, 2].map((frame) => facePlaced('idle', idle, frame)[0]?.x)).toEqual([34, 35]);
	});

	it('draws no blank head outside idle, as the room page did', () => {
		const walk = motions['walk'];
		expect(walk && facePlaced('walk', walk, 1)).toEqual([
			{ file: 'm/face/walk/eyes.png', x: 47, y: 23, width: 10, height: 8 },
		]);
	});
});
