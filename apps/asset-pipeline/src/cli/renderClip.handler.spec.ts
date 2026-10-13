import {
	type ClipJob,
	ClipMode,
	type ClipResult,
	exportConfigSchema,
	frameCutConfigSchema,
	headTrackConfigSchema,
	type IVideoRenderer,
	RenderClipService,
} from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import type { FigureSetup } from '../figureConfig.ts';
import { renderClipHandler } from './renderClip.handler.ts';

/** Keeps every job and answers with a clip named after it. */
class InMemoryVideoRenderer implements IVideoRenderer {
	readonly jobs: ClipJob[] = [];

	render(job: ClipJob): Promise<ClipResult> {
		this.jobs.push(job);
		return Promise.resolve({ clip: `/r/clips/${job.figure}-${job.motion}.mp4` });
	}
}

const setup = {
	sources: '/src',
	data: '/data',
	figures: {
		m: {
			ear: { left: 1, top: 1, right: 9, bottom: 9 },
			face: {},
			motions: {
				idle: {
					mode: ClipMode.Loop,
					frames: 49,
					endStrength: 0.8,
					prompt: 'prompts/idle.txt',
					still: 'm/idle-start.png',
					trackStill: 'm/open.png',
				},
			},
		},
	},
	cut: frameCutConfigSchema.parse({}),
	track: headTrackConfigSchema.parse({}),
	export: exportConfigSchema.parse({}),
} as unknown as FigureSetup;

describe('renderClipHandler', () => {
	it('renders the clip the data file defines, from the sources and the data folder', async () => {
		const renderer = new InMemoryVideoRenderer();
		const lines = await renderClipHandler(['m', 'idle'], setup, new RenderClipService(renderer));
		expect(renderer.jobs).toEqual([
			{
				figure: 'm',
				motion: 'idle',
				mode: 'loop',
				still: '/src/m/idle-start.png',
				promptFile: '/data/prompts/idle.txt',
				frames: 49,
				endStrength: 0.8,
			},
		]);
		expect(lines).toEqual(['done m idle', '/r/clips/m-idle.mp4']);
	});
});
