import { describe, expect, it } from 'vitest';
import { FacePart } from './facePart.enum.ts';
import { figureManifestSchema } from './figureManifest.schema.ts';
import { HeadPartKind } from './headPartKind.enum.ts';

const idle = {
	frames: [
		{ file: 'm/body/idle/00.png', hold: 1 },
		{ file: 'm/body/idle/01.png', hold: 1 },
	],
	width: 89,
	height: 201,
	advance: 0,
	head: {
		scale: 0.345,
		origin: [
			[-48.3, -36.0],
			[-48.2, -36.1],
		],
	},
	face: { [FacePart.Mouth]: { file: 'm/face/idle/mouth.png', x: 101.2, y: 88.4, width: 20.7, height: 9.3 } },
};
const manifest = { version: 1, figures: { m: { motions: { idle } } } };

describe('figureManifestSchema', () => {
	it('accepts a figure with a motion, its frames, head and face', () => {
		expect(figureManifestSchema.parse(manifest)).toEqual(manifest);
	});

	it('accepts head parts per kind and variant, a hat with its hide, and the lift and open hats of the figure', () => {
		const at = { x: 1, y: -2, width: 30, height: 20 };
		const parts = {
			[HeadPartKind.Hair]: { '1': { file: 'm/head/idle/hair-1.png', ...at } },
			[HeadPartKind.Hat]: {
				'4': { file: 'm/head/idle/hat-4.png', ...at, hide: { file: 'm/head/idle/hat-4-hide.png', ...at } },
			},
		};
		const dressed = {
			version: 1,
			figures: { m: { head: { lift: { '1': 12 }, openTop: [12] }, motions: { idle: { ...idle, parts } } } },
		};
		expect(figureManifestSchema.parse(dressed)).toEqual(dressed);
	});

	it.each([
		['another format version', { ...manifest, version: 2 }],
		[
			'a variant id that is no number',
			{
				version: 1,
				figures: {
					m: {
						motions: {
							idle: { ...idle, parts: { hair: { a: { file: 'm/x.png', x: 0, y: 0, width: 1, height: 1 } } } },
						},
					},
				},
			},
		],
		[
			'a kind that does not exist',
			{ version: 1, figures: { m: { motions: { idle: { ...idle, parts: { cape: {} } } } } } },
		],
		[
			'a negative lift',
			{ version: 1, figures: { m: { head: { lift: { '1': -3 }, openTop: [] }, motions: { idle } } } },
		],
		[
			'fewer head origins than frames',
			{ version: 1, figures: { m: { motions: { idle: { ...idle, head: { scale: 0.345, origin: [[0, 0]] } } } } } },
		],
		[
			'a frame outside the figures folder',
			{
				version: 1,
				figures: {
					m: {
						motions: {
							idle: {
								...idle,
								frames: [
									{ file: '../x.png', hold: 1 },
									{ file: 'a.png', hold: 1 },
								],
							},
						},
					},
				},
			},
		],
		[
			'an unknown face part',
			{ version: 1, figures: { m: { motions: { idle: { ...idle, face: { beard: idle.face.mouth } } } } } },
		],
		['a figure name with capitals', { version: 1, figures: { M: { motions: { idle } } } }],
		[
			'a hold of zero',
			{
				version: 1,
				figures: {
					m: {
						motions: {
							idle: {
								...idle,
								frames: [
									{ file: 'a.png', hold: 0 },
									{ file: 'b.png', hold: 1 },
								],
							},
						},
					},
				},
			},
		],
	])('refuses %s', (_, invalid) => {
		expect(figureManifestSchema.safeParse(invalid).success).toBe(false);
	});
});
