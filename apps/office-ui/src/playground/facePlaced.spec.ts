import { describe, expect, it } from 'vitest';
import { FacePart } from '@pixecutive/protocol';
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

	it('draws no blank head over the walk, whose sprites have a blank face', () => {
		const walk = motions['walk'];
		expect(walk && facePlaced('walk', walk, 1)).toEqual([
			{ file: 'm/face/walk/eyes.png', x: 47, y: 23, width: 10, height: 8 },
			{ file: 'm/face/walk/mouth.png', x: 56, y: 23, width: 10, height: 8 },
		]);
	});

	it('puts the mouth in the state asked for, and the closed mouth where the motion has no such state', () => {
		const [idle, walk] = [motions['idle'], motions['walk']];
		expect([
			idle && facePlaced('idle', idle, 1, FacePart.MouthOpen).at(-1),
			walk && facePlaced('walk', walk, 1, FacePart.MouthOpen).map((part) => part.file),
		]).toEqual([
			{ file: 'm/face/idle/mouth-open.png', x: 49, y: 24, width: 10, height: 11 },
			['m/face/walk/eyes.png', 'm/face/walk/mouth.png'],
		]);
	});
});
