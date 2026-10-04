import { describe, expect, it } from 'vitest';
import { visionAnswer } from './visionAnswer.ts';

describe('visionAnswer', () => {
	it('reads a clear yes in any case and with punctuation', () => {
		expect(['yes', 'Yes.', ' YES, it does', '"yes"'].map(visionAnswer)).toEqual([true, true, true, true]);
	});

	it('counts no, doubt and empty answers as no', () => {
		expect(['no', 'Not really', '', 'yesterday', 'maybe yes'].map(visionAnswer)).toEqual([
			false,
			false,
			false,
			false,
			false,
		]);
	});
});
