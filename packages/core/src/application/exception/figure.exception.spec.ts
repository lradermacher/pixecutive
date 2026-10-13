import { describe, expect, it } from 'vitest';
import { FigureException } from './figure.exception.ts';
import { FigureExceptionKey } from './figureExceptionKey.enum.ts';

describe('FigureException', () => {
	it('carries its key and detail, and names both in its message', () => {
		const failure = new FigureException(FigureExceptionKey.MissingFrame, 'no measure for video frame 50 of 49');
		expect([failure.key, failure.detail, failure.name]).toEqual([
			FigureExceptionKey.MissingFrame,
			'no measure for video frame 50 of 49',
			'FigureException',
		]);
		expect(failure.message).toBe('figure.missing_frame: no measure for video frame 50 of 49');
	});
});
