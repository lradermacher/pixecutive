import {
	FigureException,
	FigureExceptionKey,
	headCutConfigSchema,
	type IImageEditor,
	type ImageEditJob,
	type IPartCutter,
	MakeHeadPartService,
} from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import type { FigureSetup } from '../figureConfig.ts';
import { drawPartHandler } from './drawPart.handler.ts';

/** Keeps every drawing it is asked for. */
class InMemoryImageEditor implements IImageEditor {
	readonly jobs: ImageEditJob[] = [];
	edit(job: ImageEditJob): Promise<void> {
		this.jobs.push(job);
		return Promise.resolve();
	}
}

/** A cutter the drawing never asks. */
const cutter = {} as IPartCutter;

const head = {
	columns: 3,
	rows: 3,
	width: 1024,
	height: 1024,
	box: { left: 120, top: 60, right: 400, bottom: 340 },
	still: 'm/green.png',
};
const setup = {
	rendersDir: '/r',
	sources: '/src',
	data: '/data',
	headCut: headCutConfigSchema.parse({}),
	figures: {
		m: {
			ear: { left: 184, top: 215, right: 216, bottom: 260 },
			face: {
				blank: { image: 'm/blank2.png', mask: 'm/blank2_mask.png' },
				brows: { image: 'm/part_brows.png' },
				eyes: { image: 'm/part_eyes.png' },
				nose: { image: 'm/part_nose.png' },
				mouth: { image: 'm/part_mouth.png' },
			},
			head: {
				open: 'm/open.png',
				green: 'm/green.png',
				greenAccessory: 'm/green-accessory.png',
				greenOpen: 'm/green-open.png',
				grids: { head },
				kinds: {
					hair: {
						ids: [1, 2, 3],
						draws: [{ prompt: 'head/hair.txt', grid: 'head', ids: [1, 2, 3], fill: { who: 'man' } }],
					},
					hat: { ids: [4], draws: [{ prompt: 'head/hat.txt', ids: [4], fill: { what: 'a beanie' } }] },
					'hair-under-hat': { ids: [1], hat: 4, shrink: 17, draws: [{ prompt: 'head/hair-under-hat.txt', ids: [1] }] },
				},
			},
			motions: {},
		},
		f: {
			ear: { left: 184, top: 215, right: 216, bottom: 260 },
			face: {},
			head: {
				open: 'f/open.png',
				green: 'f/green.png',
				greenAccessory: 'f/green-accessory.png',
				greenOpen: 'f/green-open.png',
				grids: {},
				kinds: { glasses: { ids: [1], fittedFrom: { figure: 'm', scale: 0.98, dx: -20.5, dy: -10.5 } } },
			},
			motions: {},
		},
	},
} as unknown as FigureSetup;

const failureKey = (running: () => Promise<unknown>): Promise<unknown> =>
	Promise.resolve()
		.then(running)
		.then(
			() => 'resolved',
			(failure: unknown) => (failure instanceof FigureException ? failure.key : failure),
		);

describe('drawPartHandler', () => {
	const read = (path: string): string => `prompt of ${path}`;

	it('draws a grid kind on its grid into the numbered drawing, with its prompt', async () => {
		const editor = new InMemoryImageEditor();
		const parts = new MakeHeadPartService(editor, cutter);
		await drawPartHandler(['m', 'hair', '1'], setup, parts, read);
		expect(editor.jobs).toEqual([
			{
				input: '/r/head/m/grid-head.png',
				prompt: 'prompt of /data/head/hair.txt',
				output: '/r/head/m/hair/drawing-1.png',
			},
		]);
	});

	it('draws a hat on the image the core picks and hair under a hat on its input, each into its variant', async () => {
		const editor = new InMemoryImageEditor();
		const parts = new MakeHeadPartService(editor, cutter);
		await drawPartHandler(['m', 'hat', '1'], setup, parts, read);
		await drawPartHandler(['m', 'hair-under-hat', '1'], setup, parts, read);
		expect(editor.jobs).toEqual([
			expect.objectContaining({ input: '/src/m/green-open.png', output: '/r/head/m/hat/4.png' }),
			expect.objectContaining({
				input: '/r/head/m/hair-under-hat/input-1.png',
				output: '/r/head/m/hair-under-hat/1.png',
			}),
		]);
	});

	it('refuses a drawing the kind does not list and a prompt that cannot be read', async () => {
		const service = new MakeHeadPartService(new InMemoryImageEditor(), cutter);
		const unreadable = (): string => {
			throw new TypeError('no such file');
		};
		expect([
			await failureKey(() => drawPartHandler(['m', 'hair', '2'], setup, service, read)),
			await failureKey(() => drawPartHandler(['m', 'hair', '1'], setup, service, unreadable)),
		]).toEqual([FigureExceptionKey.InvalidJob, FigureExceptionKey.InvalidJob]);
	});
});
