import { describe, expect, it } from 'vitest';
import { packageName as dependencyName } from '@pixecutive/infrastructure';
import { packageName } from './index.ts';

describe('@pixecutive/asset-pipeline', () => {
	it('exposes its workspace name through its entry', () => {
		expect(packageName).toBe('@pixecutive/asset-pipeline');
	});

	it('resolves its workspace dependency @pixecutive/infrastructure', () => {
		expect(dependencyName).toBe('@pixecutive/infrastructure');
	});
});
