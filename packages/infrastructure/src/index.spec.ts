import { describe, expect, it } from 'vitest';
import { packageName as dependencyName } from '@pixecutive/core';
import {
	FrameCutterOpencvAdapter,
	FrameMeasurerOpencvAdapter,
	HeadTrackerOpencvAdapter,
	packageName,
	VideoRendererLtxAdapter,
} from './index.ts';

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

	it('exposes the frame adapters through its entry', () => {
		expect([
			typeof FrameMeasurerOpencvAdapter.prototype.measure,
			typeof FrameCutterOpencvAdapter.prototype.cut,
		]).toEqual(['function', 'function']);
	});

	it('exposes the head tracker through its entry', () => {
		expect(typeof HeadTrackerOpencvAdapter.prototype.track).toBe('function');
	});
});
