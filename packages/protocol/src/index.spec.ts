import { describe, expect, it } from 'vitest';
import { packageName } from './index.ts';

describe('@pixecutive/protocol', () => {
	it('exposes its workspace name through its entry', () => {
		expect(packageName).toBe('@pixecutive/protocol');
	});
});
