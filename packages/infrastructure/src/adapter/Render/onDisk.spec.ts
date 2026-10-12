import { RenderException, RenderExceptionKey } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { onDisk } from './onDisk.ts';

describe('onDisk', () => {
	it('answers what the step returns', () => {
		expect(onDisk('read', () => 'content')).toBe('content');
	});

	it('turns a failed step into the storage key naming the step', () => {
		const failure: unknown = ((): unknown => {
			try {
				return onDisk('read the log', () => {
					throw new TypeError('EACCES');
				});
			} catch (error) {
				return error;
			}
		})();
		expect(failure instanceof RenderException && [failure.key, failure.detail]).toEqual([
			RenderExceptionKey.StorageFailed,
			'read the log: EACCES',
		]);
	});
});
