import { describe, expect, it } from 'vitest';
import { renderJobSchema } from './renderJob.schema.ts';

const job = { promptFile: 'figure.txt', inputImage: 'figure.png', seed: 11, width: 1024, height: 768 };

describe('renderJobSchema', () => {
	it('accepts a job on the 16 pixel grid', () => {
		expect(renderJobSchema.parse(job)).toEqual(job);
	});

	it.each([
		['a side off the 16 pixel grid', { ...job, width: 1000 }],
		['a side below 256', { ...job, height: 240 }],
		['a side above 2048', { ...job, width: 2064 }],
		['a seed that is no integer', { ...job, seed: 1.5 }],
		['a seed above 32 bits', { ...job, seed: 4294967296 }],
		['a prompt that is no text file', { ...job, promptFile: 'figure.md' }],
		['an input that is no PNG', { ...job, inputImage: 'figure.jpg' }],
	])('refuses %s', (_, invalid) => {
		expect(renderJobSchema.safeParse(invalid).success).toBe(false);
	});
});
