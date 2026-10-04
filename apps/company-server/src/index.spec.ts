import { describe, expect, it } from 'vitest';
import { packageName as dependencyName } from '@pixecutive/core';
import { packageName } from './index.ts';

describe('@pixecutive/company-server', () => {
	it('exposes its workspace name through its entry', () => {
		expect(packageName).toBe('@pixecutive/company-server');
	});

	it('resolves its workspace dependency @pixecutive/core', () => {
		expect(dependencyName).toBe('@pixecutive/core');
	});
});
