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

	it('rejects a size without its height with the invalid job key', async () => {
		const failure: unknown = await renderImageHandler(['figure.txt', 'figure.png', '11', '768'], service([])).catch(
			(error: unknown) => error,
		);
		expect(failure instanceof RenderException && failure.key).toBe(RenderExceptionKey.InvalidJob);
	});

	it.each([
		['no seed', ['figure.txt', 'figure.png']],
		['a seed in hexadecimal', ['figure.txt', 'figure.png', '0x1F']],
		['a seed with an exponent', ['figure.txt', 'figure.png', '1e3']],
		['a size with three sides', ['figure.txt', 'figure.png', '11', '512x512x9']],
		['a fifth argument', ['figure.txt', 'figure.png', '11', '512x512', 'junk']],
	])('rejects %s with the invalid job key and never renders', async (_, args) => {
		const jobs: RenderJob[] = [];
		const failure: unknown = await renderImageHandler(args, service(jobs)).catch((error: unknown) => error);
		expect(failure instanceof RenderException && failure.key).toBe(RenderExceptionKey.InvalidJob);
		expect(jobs).toEqual([]);
	});

	it('rejects missing arguments with the invalid job key', async () => {
		const failure: unknown = await renderImageHandler(['figure.txt'], service([])).catch((error: unknown) => error);
		expect(failure instanceof RenderException && failure.key).toBe(RenderExceptionKey.InvalidJob);
	});
});
