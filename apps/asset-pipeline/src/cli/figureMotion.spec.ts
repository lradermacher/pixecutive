import { ClipMode, FigureException, FigureExceptionKey, FigureName, type FiguresSpec, Motion } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { figureMotion } from './figureMotion.ts';

const idle = {
	mode: ClipMode.Loop,
	frames: 49,
	endStrength: 0.8,
	prompt: 'prompts/idle.txt',
	still: 'm/s.png',
	trackStill: 'm/o.png',
};
const figures: FiguresSpec = { m: { ear: { left: 1, top: 1, right: 9, bottom: 9 }, face: {}, motions: { idle } } };

function failure(args: string[]): string | null {
	try {
		figureMotion(args, figures);
		return null;
	} catch (error) {
		return error instanceof FigureException && error.key === FigureExceptionKey.InvalidJob ? error.detail : 'other';
	}
}

describe('figureMotion', () => {
	it('finds the named figure and motion in the specs', () => {
		const found = figureMotion(['m', 'idle'], figures);
		expect([found.figure, found.motion, found.motionSpec.frames]).toEqual([FigureName.M, Motion.Idle, 49]);
	});

	it('refuses an unknown figure or motion with the invalid job key and the choices', () => {
		expect(failure(['x', 'idle'])).toBe('expected <figure> <motion>, one of m|f and idle|walk');
	});

	it('refuses a motion the data file does not hold', () => {
		expect(failure(['m', 'walk'])).toBe('the data file holds no m walk');
	});
});
