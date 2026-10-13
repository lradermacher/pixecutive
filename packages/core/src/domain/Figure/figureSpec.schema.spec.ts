import { describe, expect, it } from 'vitest';
import { figuresSpecSchema } from './figureSpec.schema.ts';

const idle = {
	mode: 'loop',
	frames: 49,
	endStrength: 0.8,
	prompt: 'prompts/m-idle.txt',
	still: 'm/idle-start.png',
	range: { first: 0, last: 47 },
	use: { first: 11, last: 34 },
	trackStill: 'm/open.png',
};
const spec = {
	m: {
		ear: { left: 184, top: 215, right: 216, bottom: 260 },
		face: { blank: { image: 'm/blank2.png', mask: 'm/blank2_mask.png' }, mouth: { image: 'm/part_mouth.png' } },
		motions: { idle },
	},
};

describe('figuresSpecSchema', () => {
	it('accepts a figure with its ear, face and a motion', () => {
		expect(figuresSpecSchema.parse(spec)).toEqual(spec);
	});

	it.each([
		['an unknown figure', { x: spec.m }],
		['an unknown motion', { m: { ...spec.m, motions: { dance: idle } } }],
		['an unknown face part', { m: { ...spec.m, face: { beard: { image: 'b.png' } } } }],
		[
			'a used range that runs backwards',
			{ m: { ...spec.m, motions: { idle: { ...idle, use: { first: 34, last: 11 } } } } },
		],
		['a clip off 8k + 1 frames', { m: { ...spec.m, motions: { idle: { ...idle, frames: 50 } } } }],
		['an ear box without area', { m: { ...spec.m, ear: { left: 1, top: 1, right: 1, bottom: 9 } } }],
	])('refuses %s', (_, invalid) => {
		expect(figuresSpecSchema.safeParse(invalid).success).toBe(false);
	});
});
