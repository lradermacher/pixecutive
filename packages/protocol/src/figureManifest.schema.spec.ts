import { describe, expect, it } from 'vitest';
import { FacePart } from './facePart.enum.ts';
import { figureManifestSchema } from './figureManifest.schema.ts';

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

	it.each([
		['another format version', { ...manifest, version: 2 }],
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
