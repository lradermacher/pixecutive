// lockFailure.enum.ts — the two ways the local job lock can fail; each adapter names them with its own keys.

/** Another job holds the lock, or the lock file could not be used. */
export enum LockFailure {
	Busy = 'busy',
	Storage = 'storage',
}
