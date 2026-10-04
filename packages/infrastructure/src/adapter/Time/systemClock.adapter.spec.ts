import { describe, expect, it } from 'vitest';
import { SystemClockAdapter } from './systemClock.adapter.ts';

describe('SystemClockAdapter', () => {
	it('answers the current time', () => {
		const before = Date.now();
		const now = new SystemClockAdapter().now().getTime();
		expect(now).toBeGreaterThanOrEqual(before);
		expect(now).toBeLessThanOrEqual(Date.now());
	});
});
