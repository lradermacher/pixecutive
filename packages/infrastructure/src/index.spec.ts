import { describe, expect, it } from 'vitest';
import { packageName as dependencyName } from '@pixecutive/core';
import { packageName, VideoRendererLtxAdapter } from './index.ts';

describe('@pixecutive/infrastructure', () => {
	it('exposes its workspace name through its entry', () => {
		expect(packageName).toBe('@pixecutive/infrastructure');
	});

	it('resolves its workspace dependency @pixecutive/core', () => {
		expect(dependencyName).toBe('@pixecutive/core');
	});

	it('exposes the video adapter through its entry', () => {
		expect(typeof VideoRendererLtxAdapter.prototype.render).toBe('function');
	});
});
