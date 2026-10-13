import { FigureException, FigureExceptionKey, RenderException, RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { exitAnswer } from './exitAnswer.ts';
import { figureExitCode } from './figureExitCode.ts';
import { renderExitCode } from './renderExitCode.ts';

describe('exitAnswer', () => {
	it.each(Object.values(RenderExceptionKey))('answers %s with its own code and message', (key) => {
		const answer = exitAnswer(new RenderException(key, 'what was measured'));
		expect(answer.code).toBe(renderExitCode[key].code);
		expect(answer.message).toBe(`${renderExitCode[key].message} (${key}): what was measured`);
	});

	it.each(Object.values(FigureExceptionKey))('answers %s with its own code and message', (key) => {
		const answer = exitAnswer(new FigureException(key, 'what was measured'));
		expect(answer).toEqual({
			code: figureExitCode[key].code,
			message: `${figureExitCode[key].message} (${key}): what was measured`,
		});
	});

	it('answers 1 and the failure itself for anything that is no render failure', () => {
		expect(exitAnswer(new TypeError('broken'))).toEqual({ code: 1, message: 'TypeError: broken' });
	});
});
