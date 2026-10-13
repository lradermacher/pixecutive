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
	it.each([49, 73, 9, 257])('accepts a clip of %i frames', (frames) => {
		expect(clipJobSchema.parse({ ...job, frames }).frames).toBe(frames);
	});

	it.each([
		['a frame count off 8k + 1', { ...job, frames: 48 }],
		['a clip shorter than 9 frames', { ...job, frames: 1 }],
		['a clip longer than 257 frames', { ...job, frames: 265 }],
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
