import { describe, expect, it } from 'vitest';
import type { RenderJob } from '../../domain/Render/renderJob.schema.ts';
import type { RenderResult } from '../../domain/Render/renderResult.interface.ts';
import type { RenderStatus } from '../../domain/Render/renderStatus.interface.ts';
import type { ILocalRenderer } from '../../port/outgoing/localRenderer.interface.ts';
import { RenderException } from '../exception/render.exception.ts';
import { RenderExceptionKey } from '../exception/renderExceptionKey.enum.ts';
import { RenderImageService } from './renderImage.service.ts';
import type { RenderImageCommand } from './renderImageCommand.ts';

/** Keeps every job it was handed and answers with an image named after the job's seed. */
class InMemoryLocalRenderer implements ILocalRenderer {
	readonly jobs: RenderJob[] = [];

	render(job: RenderJob): Promise<RenderResult> {
		this.jobs.push(job);
		return Promise.resolve({ name: `figure-s${String(job.seed)}`, image: `figure-s${String(job.seed)}.png` });
	}

	status(): RenderStatus {
		return { running: null, pressure: 1, swapMb: 0, lastRows: [`${String(this.jobs.length)} jobs`] };
	}
}

const command: RenderImageCommand = {
	promptFile: 'figure.txt',
	inputImage: 'figure.png',
	seed: 11,
	width: 1024,
	height: 768,
};

describe('RenderImageService', () => {
	it('parses a valid command into a job for the renderer and answers its result', async () => {
		const renderer = new InMemoryLocalRenderer();
		expect(await new RenderImageService(renderer).render(command)).toEqual({
			name: 'figure-s11',
			image: 'figure-s11.png',
		});
		expect(renderer.jobs).toEqual([command]);
	});

	it.each([
		['a size off the 16 pixel grid', { ...command, width: 1000 }],
		['a negative seed', { ...command, seed: -1 }],
		['a prompt that is no text file', { ...command, promptFile: 'figure.png' }],
		['an input that is no PNG', { ...command, inputImage: 'figure.jpg' }],
	])('refuses %s with the invalid job key and never starts the model', async (_, invalid) => {
		const renderer = new InMemoryLocalRenderer();
		const failure: unknown = await new RenderImageService(renderer).render(invalid).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(RenderException);
		expect((failure as RenderException).key).toBe(RenderExceptionKey.InvalidJob);
		expect(renderer.jobs).toEqual([]);
	});

	it('names the field that is wrong', async () => {
		const failure: unknown = await new RenderImageService(new InMemoryLocalRenderer())
			.render({ ...command, seed: Number.NaN })
			.catch((error: unknown) => error);
		expect(failure instanceof RenderException && failure.detail).toMatch(/^seed: /);
	});

	it('answers the renderer status', () => {
		expect(new RenderImageService(new InMemoryLocalRenderer()).status().lastRows).toEqual(['0 jobs']);
	});
});
