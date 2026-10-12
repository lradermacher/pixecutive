import { describe, expect, it } from 'vitest';
import { renderLogRow } from './renderLogRow.ts';

const record = {
	at: new Date('2026-10-04T20:30:00.000Z'),
	name: 'base-m',
	seed: 11,
	model: 'qwen',
	steps: 8,
	size: '1024x512',
	firstStepSeconds: null,
	totalSeconds: 36,
	secondsPerStep: 17.8,
	peakPressure: 2,
	swapPeakMb: 9971,
	result: 'ABORT: swap +9971 MB over the 8192 MB limit',
};

describe('renderLogRow', () => {
	it('writes eleven columns and a dash for what was never measured', () => {
		const columns = renderLogRow(record).split('\t');
		expect(columns).toHaveLength(11);
		expect(columns[0]).toBe('2026-10-04 20:30 UTC');
		expect(columns[5]).toBe('- s');
		expect(columns[10]).toBe('ABORT: swap +9971 MB over the 8192 MB limit');
	});
});
