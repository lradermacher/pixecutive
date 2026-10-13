import { FigureExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { figureExitCode } from './figureExitCode.ts';
import { renderExitCode } from './renderExitCode.ts';

describe('figureExitCode', () => {
	it('answers every key with its own code, none shared with a render key, none below 12', () => {
		const codes = Object.values(FigureExceptionKey).map((key) => figureExitCode[key].code);
		const renderCodes = new Set(Object.values(renderExitCode).map((answer) => answer.code));
		expect(new Set(codes).size).toBe(codes.length);
		expect(codes.filter((code) => renderCodes.has(code) || code < 12)).toEqual([]);
	});
});
