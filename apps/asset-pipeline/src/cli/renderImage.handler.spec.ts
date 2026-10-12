import {
	type ILocalRenderer,
	type RenderJob,
	RenderException,
	RenderExceptionKey,
	RenderImageService,
} from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import { renderImageHandler } from './renderImage.handler.ts';

/** Keeps the jobs it gets and answers an image named after the seed. */
function service(jobs: RenderJob[]): RenderImageService {
	const renderer: ILocalRenderer = {
		render: (job) => {
			jobs.push(job);
			return Promise.resolve({
				name: `figure-s${String(job.seed)}`,
				image: `/renders/figure-s${String(job.seed)}.png`,
			});
		},
		status: () => ({ running: null, pressure: 1, swapMb: 0, lastRows: [] }),
	};
	return new RenderImageService(renderer);
}

describe('renderImageHandler', () => {
	it('renders the job of its arguments at the default size', async () => {
		const jobs: RenderJob[] = [];
		expect(await renderImageHandler(['figure.txt', 'figure.png', '11'], service(jobs))).toEqual([
			'done figure-s11',
			'/renders/figure-s11.png',
		]);
		expect(jobs).toEqual([{ promptFile: 'figure.txt', inputImage: 'figure.png', seed: 11, width: 1024, height: 1024 }]);
	});

	it('takes a size', async () => {
		const jobs: RenderJob[] = [];
		await renderImageHandler(['figure.txt', 'figure.png', '11', '768x512'], service(jobs));
		expect([jobs[0]?.width, jobs[0]?.height]).toEqual([768, 512]);
	});

	it('rejects missing arguments with the invalid job key', async () => {
		const failure: unknown = await renderImageHandler(['figure.txt'], service([])).catch((error: unknown) => error);
		expect(failure instanceof RenderException && failure.key).toBe(RenderExceptionKey.InvalidJob);
	});
});
