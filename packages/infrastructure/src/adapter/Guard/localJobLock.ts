// localJobLock.ts — the lock that lets one local model job (image or video) run at a time on this machine: taken
// atomically, rewritten without an empty moment. Each adapter names its two failures with its own keyed exception.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { LockFailure } from './lockFailure.enum.ts';

/** Turns a lock failure into the calling adapter's keyed exception. */
export type LockFailureName = (failure: LockFailure, detail: string) => Error;

/** Whether a process still runs; an ID that is no positive integer belongs to no process. */
function isAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (failure) {
		return (failure as NodeJS.ErrnoException).code === 'EPERM';
	}
}

/**
 * The lock file of one renders folder, shared by every local model job. Its line holds the IDs of the processes of a
 * job, then the job's label; the job runs while any of these processes lives, and a lock whose processes are all gone
 * is cleared.
 * @throws {Error} what `name` makes of a failure, from every method: busy from `take`, storage when the file cannot be
 * used.
 */
export class LocalJobLock {
	constructor(
		private readonly path: string,
		private readonly name: LockFailureName,
	) {}

	/**
	 * Runs one step on the lock file and names a failure as storage.
	 * @throws {Error} what `name` makes of the storage failure.
	 */
	private onDisk<T>(what: string, step: () => T): T {
		try {
			return step();
		} catch (failure) {
			throw this.name(LockFailure.Storage, `${what}: ${(failure as Error).message}`);
		}
	}

	/**
	 * Takes the lock for `label` only if no other job holds the file, also not one that was quicker a moment ago.
	 * @throws {Error} what `name` makes of busy when the file exists, or of storage when it cannot be written.
	 */
	take(label: string): void {
		try {
			writeFileSync(this.path, `${String(process.pid)}\t${label}`, { flag: 'wx' });
		} catch (failure) {
			if ((failure as NodeJS.ErrnoException).code === 'EEXIST') {
				throw this.name(LockFailure.Busy, 'another job took the lock first');
			}
			throw this.name(LockFailure.Storage, `take the lock: ${(failure as Error).message}`);
		}
	}

	/**
	 * Rewrites the lock through a renamed side file, so a reader never sees it empty.
	 * @throws {Error} what `name` makes of storage when the file cannot be written.
	 */
	update(processIds: readonly number[], label: string): void {
		const next = `${this.path}.next`;
		this.onDisk('update the lock', () => {
			writeFileSync(next, `${processIds.join(',')}\t${label}`);
			renameSync(next, this.path);
		});
	}

	/**
	 * The label of the running job, or null; a lock whose processes are all gone is removed.
	 * @throws {Error} what `name` makes of storage when the lock cannot be read or cleared.
	 */
	running(): string | null {
		if (!existsSync(this.path)) return null;
		const [processIds = '', label = ''] = this.onDisk('read the lock', () => readFileSync(this.path, 'utf8'))
			.trim()
			.split('\t');
		if (processIds.split(',').map(Number).some(isAlive)) return label;
		this.release();
		return null;
	}

	/**
	 * Removes the lock.
	 * @throws {Error} what `name` makes of storage when it cannot be removed.
	 */
	release(): void {
		this.onDisk('remove the lock', () => {
			rmSync(this.path, { force: true });
		});
	}
}
