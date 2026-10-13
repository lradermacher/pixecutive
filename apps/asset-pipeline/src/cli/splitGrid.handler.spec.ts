import {
	FigureException,
	FigureExceptionKey,
	headCutConfigSchema,
	type MakeHeadPartService,
	type PartCutResult,
} from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import type { FigureSetup } from '../figureConfig.ts';
import { splitGridHandler } from './splitGrid.handler.ts';

/** Keeps every call to the head-part use cases by name and arguments; a cut answers 120 pixels at scale 1. */
class RecordingHeadParts {
	readonly calls: [string, unknown[]][] = [];
	private keep(name: string, args: unknown[]): Promise<void> {
		this.calls.push([name, args]);
		return Promise.resolve();
	}
	grid(...args: unknown[]): Promise<void> {
		return this.keep('grid', args);
	}
	draw(...args: unknown[]): Promise<void> {
		return this.keep('draw', args);
	}
	split(...args: unknown[]): Promise<void> {
		return this.keep('split', args);
	}
	cut(...args: unknown[]): Promise<PartCutResult> {
		return this.keep('cut', args).then(() => ({ pixels: 120, scale: 1, dx: 0, dy: -2 }));
	}
	underHat(...args: unknown[]): Promise<void> {
		return this.keep('underHat', args);
	}
	fit(...args: unknown[]): Promise<void> {
		return this.keep('fit', args);
	}
}

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

describe('splitGridHandler', () => {
	it('splits the drawn grid into the stills of the variants it drew, on copies of the grid still', async () => {
		const parts = new RecordingHeadParts();
		await splitGridHandler(['m', 'hair', '1'], setup, parts as unknown as MakeHeadPartService);
		expect(parts.calls).toEqual([
			[
				'split',
				[
					{
						grid: '/r/head/m/hair/drawing-1.png',
						layout: head,
						base: '/src/m/green.png',
						outs: ['/r/head/m/hair/1.png', '/r/head/m/hair/2.png', '/r/head/m/hair/3.png'],
					},
				],
			],
		]);
	});

	it('refuses a kind drawn without a grid', async () => {
		const parts = new RecordingHeadParts();
		expect(
			await failureKey(() => splitGridHandler(['m', 'hat', '1'], setup, parts as unknown as MakeHeadPartService)),
		).toBe(FigureExceptionKey.InvalidJob);
	});
});
