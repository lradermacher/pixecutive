import { type ILocalRenderer, RenderImageService, type RenderStatus } from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { showRenderStatusHandler } from './showRenderStatus.handler.ts';

/** Answers a fixed status; this handler never renders. */
function serviceWith(status: RenderStatus): RenderImageService {
	const renderer: ILocalRenderer = {
		render: () => Promise.reject(new TypeError('the status handler never renders')),
		status: () => status,
	};
	return new RenderImageService(renderer);
}

describe('showRenderStatusHandler', () => {
	it('says idle and shows the memory and the log rows', () => {
		const service = serviceWith({ running: null, pressure: 1, swapMb: 7000, lastRows: ['a', 'b'] });
		expect(showRenderStatusHandler(service)).toEqual(['idle', 'memory pressure 1 · swap 7000 MB', 'a', 'b']);
	});

	it('names the running render', () => {
		const service = serviceWith({ running: 'figure-s11', pressure: 2, swapMb: 9000, lastRows: [] });
		expect(showRenderStatusHandler(service)[0]).toBe('running figure-s11');
	});
});
