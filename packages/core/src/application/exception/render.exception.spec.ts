import { describe, expect, it } from 'vitest';
import { RenderException } from './render.exception.ts';
import { RenderExceptionKey } from './renderExceptionKey.enum.ts';

describe('RenderException', () => {
	it('carries its key and detail, and names both in its message', () => {
		const failure = new RenderException(RenderExceptionKey.Busy, 'a render is running (figure-s11)');
		expect([failure.key, failure.detail, failure.name]).toEqual([
			RenderExceptionKey.Busy,
			'a render is running (figure-s11)',
			'RenderException',
		]);
		expect(failure.message).toBe('render.busy: a render is running (figure-s11)');
	});
});
