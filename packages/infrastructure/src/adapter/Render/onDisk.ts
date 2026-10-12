// onDisk.ts — one step on the renders folder, with whatever the file system answers turned into the storage key.
import { RenderException, RenderExceptionKey } from '@pixecutive/core';

/**
 * Runs `step` and names it as `what` when it fails, so no file system error leaves the adapter without its key.
 * @throws {RenderException} the storage key with the step and the file system's message.
 */
export function onDisk<T>(what: string, step: () => T): T {
	try {
		return step();
	} catch (failure) {
		throw new RenderException(RenderExceptionKey.StorageFailed, `${what}: ${(failure as Error).message}`);
	}
}
