import { describe, expect, it } from 'vitest';
import type { ClipJob } from '../../domain/Figure/clipJob.schema.ts';
import type { ClipResult } from '../../domain/Figure/clipResult.interface.ts';
import type { IVideoRenderer } from '../../port/outgoing/videoRenderer.interface.ts';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import { RenderClipService } from './renderClip.service.ts';
import type { RenderClipCommand } from './renderClipCommand.ts';

/** Keeps every job it was handed and answers with a clip named after the figure and motion. */
class InMemoryVideoRenderer implements IVideoRenderer {
	readonly jobs: ClipJob[] = [];

	render(job: ClipJob): Promise<ClipResult> {
		this.jobs.push(job);
		return Promise.resolve({ clip: `${job.figure}-${job.motion}.mp4` });
	}
}

const command: RenderClipCommand = {
	figure: 'm',
	motion: 'idle',
	mode: 'loop',
	still: 'm.png',
	promptFile: 'idle.txt',
	frames: 49,
	endStrength: 0.8,
};

describe('RenderClipService', () => {
	it('parses a valid command into a job for the renderer and answers its clip', async () => {
		const renderer = new InMemoryVideoRenderer();
		expect(await new RenderClipService(renderer).render(command)).toEqual({ clip: 'm-idle.mp4' });
		expect(renderer.jobs).toEqual([command]);
	});

	it.each([
		['a frame count off 8k + 1', { ...command, frames: 50 }],
		['an unknown motion', { ...command, motion: 'dance' }],
		['a still that is no PNG', { ...command, still: 'm.jpg' }],
	])('refuses %s with the invalid job key and never starts the model', async (_, invalid) => {
		const renderer = new InMemoryVideoRenderer();
		const failure: unknown = await new RenderClipService(renderer).render(invalid).catch((error: unknown) => error);
		expect(failure instanceof FigureException && failure.key).toBe(FigureExceptionKey.InvalidJob);
		expect(renderer.jobs).toEqual([]);
	});

	it('names the field that is wrong', async () => {
		const failure: unknown = await new RenderClipService(new InMemoryVideoRenderer())
			.render({ ...command, figure: 'x' })
			.catch((error: unknown) => error);
		expect(failure instanceof FigureException && failure.detail).toMatch(/^figure: /);
	});
});
