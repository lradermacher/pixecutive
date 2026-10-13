import { describe, expect, it } from 'vitest';
import { headTrackSchema } from './headTrack.schema.ts';

const track = {
	scale: 0.345,
	origin: [
		[12.4, 3.1],
		[12.9, 3.0],
	],
	earOffset: [0.3, 0.6],
};

describe('headTrackSchema', () => {
	it('accepts one origin and one ear check per frame', () => {
		expect(headTrackSchema.parse(track)).toEqual(track);
	});

	it.each([
		['fewer ear checks than frames', { ...track, earOffset: [0.3] }],
		['a negative ear offset', { ...track, earOffset: [0.3, -1] }],
		['an origin with one coordinate', { ...track, origin: [[12.4], [12.9, 3.0]] }],
		['a scale of zero', { ...track, scale: 0 }],
	])('refuses %s', (_, invalid) => {
		expect(headTrackSchema.safeParse(invalid).success).toBe(false);
	});
});
