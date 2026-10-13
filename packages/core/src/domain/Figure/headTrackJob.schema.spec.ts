import { describe, expect, it } from 'vitest';
import { headTrackJobSchema } from './headTrackJob.schema.ts';

const job = {
	still: 'm_open.png',
	frames: ['00.png', '01.png'],
	ear: { left: 184, top: 215, right: 216, bottom: 260 },
};

describe('headTrackJobSchema', () => {
	it('accepts a still, its frames and an ear box', () => {
		expect(headTrackJobSchema.parse(job)).toEqual(job);
	});

	it.each([
		['no frames', { ...job, frames: [] }],
		['a frame that is no PNG', { ...job, frames: ['00.jpg'] }],
		['an ear box without area', { ...job, ear: { left: 184, top: 215, right: 184, bottom: 260 } }],
		['a still that is no PNG', { ...job, still: 'm_open.webp' }],
	])('refuses %s', (_, invalid) => {
		expect(headTrackJobSchema.safeParse(invalid).success).toBe(false);
	});
});
