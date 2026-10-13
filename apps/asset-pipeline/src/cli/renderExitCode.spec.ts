import { RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { renderExitCode } from './renderExitCode.ts';

describe('renderExitCode', () => {
	it('answers every key with its own code above the usage error', () => {
		const codes = Object.values(RenderExceptionKey).map((key) => renderExitCode[key].code);
		expect(new Set(codes).size).toBe(codes.length);
		expect(Math.min(...codes)).toBeGreaterThan(2);
	});
});
