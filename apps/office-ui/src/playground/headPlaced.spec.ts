import { HeadPartKind } from '@pixecutive/protocol';
import { describe, expect, it } from 'vitest';
import { headPlaced } from './headPlaced.ts';
import type { ManifestMotion } from './manifestMotion.interface.ts';

const box = (
	file: string,
	x: number,
	y: number,
): { file: string; x: number; y: number; width: number; height: number } => ({
	file,
	x,
	y,
	width: 20,
	height: 10,
});
const motion = {
	frames: [{ file: 'm/body/idle/00.png', hold: 1 }],
	width: 90,
	height: 200,
	advance: 0,
	head: { scale: 0.5, origin: [[100, 50]] },
	face: {},
	parts: {
		[HeadPartKind.Hair]: { '1': box('hair-1.png', 1, 2), '2': box('hair-2.png', 1, 2) },
		[HeadPartKind.HairUnderHat]: { '2': box('hair-under-hat-2.png', 1, 3) },
		[HeadPartKind.Beard]: { '1': box('beard-1.png', 5, 20) },
		[HeadPartKind.Glasses]: { '1': box('glasses-1.png', 4, 12) },
		[HeadPartKind.Hat]: {
			'4': { ...box('hat-4.png', 0, -4), hide: box('hat-4-hide.png', 0, 0) },
			'12': { ...box('hat-12.png', 0, -4), hide: box('hat-12-hide.png', 0, 0) },
		},
	},
} as unknown as ManifestMotion;
const head = { lift: { '1': 12, '2': 8 }, openTop: [12] };
const files = (look: Parameters<typeof headPlaced>[3]): string[] =>
	headPlaced(motion, 0, head, look).map((p) => `${p.file}${p.cut ? ' cut' : ''}`);

describe('headPlaced', () => {
	it('places beard, hair and glasses on the head origin, back to front, and nothing for an empty look', () => {
		expect([files({ hair: 1, beard: 1, glasses: 1 }), files({})]).toEqual([
			['beard-1.png', 'hair-1.png', 'glasses-1.png'],
			[],
		]);
		expect(headPlaced(motion, 0, head, { hair: 1 })[0]).toEqual({
			file: 'hair-1.png',
			x: 101,
			y: 52,
			width: 20,
			height: 10,
		});
	});

	it('cuts the hat hide from the figure before the hair, and lifts the hat by the hair, growing it, at the motion scale', () => {
		const layers = headPlaced(motion, 0, head, { hair: 1, hat: 4 });
		expect(layers.map((p) => `${p.file}${p.cut ? ' cut' : ''}`)).toEqual([
			'hat-4-hide.png cut',
			'hair-1.png',
			'hat-4.png',
		]);
		expect(layers[2]).toEqual({ file: 'hat-4.png', x: 97, y: 40, width: 26, height: 13 });
	});

	it('draws the hairstyle under the hat in place of the hair, and then the hat does not rise', () => {
		const layers = headPlaced(motion, 0, head, { hair: 2, hat: 4 });
		expect([layers.map((p) => p.file), layers[2]?.y]).toEqual([
			['hat-4-hide.png', 'hair-under-hat-2.png', 'hat-4.png'],
			46,
		]);
	});

	it('keeps the hair whole under an open hat: no hide, no rise', () => {
		const layers = headPlaced(motion, 0, head, { hair: 1, hat: 12 });
		expect([layers.map((p) => p.file), layers[1]?.y]).toEqual([['hair-1.png', 'hat-12.png'], 46]);
	});

	it('cuts the hide of a hat on a bald head and leaves out a variant the motion lacks', () => {
		expect([files({ hat: 4 }), files({ hair: 7 })]).toEqual([['hat-4-hide.png cut', 'hat-4.png'], []]);
	});
});
