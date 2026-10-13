import { describe, expect, it } from 'vitest';
import { packageName as dependencyName } from '@pixecutive/protocol';
import { packageName } from './index.ts';

describe('@pixecutive/office-ui', () => {
	it('exposes its workspace name through its entry', () => {
		expect(packageName).toBe('@pixecutive/office-ui');
	});

	it('resolves its workspace dependency @pixecutive/protocol', () => {
		expect(dependencyName).toBe('@pixecutive/protocol');
	});
});
