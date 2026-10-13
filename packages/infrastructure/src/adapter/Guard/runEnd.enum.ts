// runEnd.enum.ts — how one run of the model ended.

/** Finished, or stopped by the guard, by an interrupt, by the renders folder, or by the model itself. */
export enum RunEnd {
	Done = 'done',
	Aborted = 'aborted',
	Interrupted = 'interrupted',
	StorageFailed = 'storage_failed',
	Failed = 'failed',
}
