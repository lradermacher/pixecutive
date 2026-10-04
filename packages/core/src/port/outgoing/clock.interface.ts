// clock.interface.ts — outgoing port for the current time.

/** The current time; production wraps the wall clock, tests a fixed instant, so time-dependent logic stays testable. */
export interface IClock {
	now(): Date;
}
