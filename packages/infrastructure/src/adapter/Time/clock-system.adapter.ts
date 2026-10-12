// clock-system.adapter.ts — the wall clock for the core's clock port; tests substitute a fixed instant.
import type { IClock } from '@pixecutive/core';

/** Production clock. */
export class ClockSystemAdapter implements IClock {
	now(): Date {
		return new Date();
	}
}
