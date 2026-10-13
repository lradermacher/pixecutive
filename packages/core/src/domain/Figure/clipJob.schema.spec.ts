import { describe, expect, it } from 'vitest';
import { clipJobSchema } from './clipJob.schema.ts';

const job = {
	figure: 'm',
	motion: 'idle',
	mode: 'loop',
	still: 'm.png',
	promptFile: 'idle.txt',
	frames: 49,
	endStrength: 0.8,
};

describe('clipJobSchema', () => {
	it('accepts a clip job', () => {
		expect(clipJobSchema.parse(job)).toEqual(job);
	});

	it.each([
		['a frame count the video model cannot render', { ...job, frames: 48 }],
		['an unknown figure', { ...job, figure: 'x' }],
		['an unknown motion', { ...job, motion: 'dance' }],
		['an unknown mode', { ...job, mode: 'free' }],
		['a still that is no PNG', { ...job, still: 'm.jpg' }],
		['a prompt that is no text file', { ...job, promptFile: 'idle.md' }],
		['an end strength above 1', { ...job, endStrength: 1.2 }],
	])('refuses %s', (_, invalid) => {
		expect(clipJobSchema.safeParse(invalid).success).toBe(false);
	});
});
