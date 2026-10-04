// clock.interface.ts — where the core gets the current time from.

/** Gives the current time as an ISO 8601 string. */
export interface IClock {
	nowIso(): string;
}
