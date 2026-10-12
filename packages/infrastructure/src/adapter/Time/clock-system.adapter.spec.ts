import { describe, expect, it } from 'vitest';
import { ClockSystemAdapter } from './clock-system.adapter.ts';

describe('ClockSystemAdapter', () => {
	it('answers the current time', () => {
		const before = Date.now();
		const now = new ClockSystemAdapter().now().getTime();
		expect(now).toBeGreaterThanOrEqual(before);
		expect(now).toBeLessThanOrEqual(Date.now());
	});
});
