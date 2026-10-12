// renderLock.ts — the lock that lets one render run at a time: taken atomically, rewritten without an empty moment.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { RenderException, RenderExceptionKey } from '@pixecutive/core';
import { onDisk } from './onDisk.ts';

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
 * The lock file of one renders folder. Its line holds the IDs of the processes of a render, then the render's label;
 * the render runs while any of these processes lives, and a lock whose processes are all gone is cleared.
 * @throws {RenderException} from every method: busy from `take`, the storage key when the file cannot be used.
 */
export class RenderLock {
	constructor(private readonly path: string) {}

	/**
	 * Takes the lock for `label` only if no other render holds the file, also not one that was quicker a moment ago.
	 * @throws {RenderException} busy when the file exists, the storage key when it cannot be written.
	 */
	take(label: string): void {
		try {
			writeFileSync(this.path, `${String(process.pid)}\t${label}`, { flag: 'wx' });
		} catch (failure) {
			if ((failure as NodeJS.ErrnoException).code === 'EEXIST') {
				throw new RenderException(RenderExceptionKey.Busy, 'another render took the lock first');
			}
			throw new RenderException(RenderExceptionKey.StorageFailed, `take the lock: ${(failure as Error).message}`);
		}
	}

	/**
	 * Rewrites the lock through a renamed side file, so a reader never sees it empty.
	 * @throws {RenderException} the storage key when the file cannot be written.
	 */
	update(processIds: readonly number[], label: string): void {
		const next = `${this.path}.next`;
		onDisk('update the lock', () => {
			writeFileSync(next, `${processIds.join(',')}\t${label}`);
			renameSync(next, this.path);
		});
	}

	/**
	 * The label of the running render, or null; a lock whose processes are all gone is removed.
	 * @throws {RenderException} the storage key when the lock cannot be read or cleared.
	 */
	running(): string | null {
		if (!existsSync(this.path)) return null;
		const [processIds = '', label = ''] = onDisk('read the lock', () => readFileSync(this.path, 'utf8'))
			.trim()
			.split('\t');
		if (processIds.split(',').map(Number).some(isAlive)) return label;
		this.release();
		return null;
	}

	/**
	 * Removes the lock.
	 * @throws {RenderException} the storage key when it cannot be removed.
	 */
	release(): void {
		onDisk('remove the lock', () => {
			rmSync(this.path, { force: true });
		});
	}
}
