import { describe, expect, it } from 'vitest';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import { headCutConfigSchema } from '../../domain/Figure/headCutConfig.schema.ts';
import { HeadPartKind } from '../../domain/Figure/headPartKind.enum.ts';
import type { ImageEditJob } from '../../domain/Figure/imageEditJob.interface.ts';
import type { PartCutResult } from '../../domain/Figure/partCutJob.interface.ts';
import type { IImageEditor } from '../../port/outgoing/imageEditor.interface.ts';
import type { IPartCutter } from '../../port/outgoing/partCutter.interface.ts';
import { MakeHeadPartService } from './makeHeadPart.service.ts';

/** Keeps every drawing it was asked for. */
class InMemoryImageEditor implements IImageEditor {
	readonly jobs: ImageEditJob[] = [];
	edit(job: ImageEditJob): Promise<void> {
		this.jobs.push(job);
		return Promise.resolve();
	}
}

/** Keeps every call by its name and job; answers the first rows it is given per layer and a skull at 107. */
class InMemoryPartCutter implements IPartCutter {
	readonly calls: [string, unknown][] = [];
	constructor(private readonly rows: Readonly<Record<string, number | null>> = {}) {}
	private keep(name: string, job: unknown): Promise<PartCutResult> {
		this.calls.push([name, job]);
		return Promise.resolve({ pixels: 1 });
	}
	grid(job: unknown): Promise<void> {
		return this.keep('grid', job).then(() => undefined);
	}
	split(job: unknown): Promise<void> {
		return this.keep('split', job).then(() => undefined);
	}
	keyCut(job: unknown): Promise<PartCutResult> {
		return this.keep('keyCut', job);
	}
	hatCut(job: unknown): Promise<PartCutResult> {
		return this.keep('hatCut', job);
	}
	glassesCut(job: unknown): Promise<PartCutResult> {
		return this.keep('glassesCut', job);
	}
	variantCut(job: unknown): Promise<PartCutResult> {
		return this.keep('variantCut', job);
	}
	underHat(job: unknown): Promise<void> {
		return this.keep('underHat', job).then(() => undefined);
	}
	fit(job: unknown): Promise<void> {
		return this.keep('fit', job).then(() => undefined);
	}
	skullTop(): Promise<number> {
		return Promise.resolve(107);
	}
	firstRow(layer: string): Promise<number | null> {
		return Promise.resolve(this.rows[layer] ?? null);
	}
}

const layout = { columns: 3, rows: 3, width: 1024, height: 1024, box: { left: 120, top: 60, right: 400, bottom: 340 } };
const values = headCutConfigSchema.parse({});
const sources = {
	green: 'm/green.png',
	greenAccessory: 'm/green-accessory.png',
	greenOpen: 'm/green-open.png',
	open: 'm/open.png',
	blank: 'm/blank2.png',
	mask: 'm/blank2_mask.png',
	defaults: {
		[HeadPartKind.Brows]: 'm/part_brows.png',
		[HeadPartKind.Eyes]: 'm/part_eyes.png',
		[HeadPartKind.Nose]: 'm/part_nose.png',
		[HeadPartKind.Mouth]: 'm/part_mouth.png',
	},
};

const failureKey = (running: () => Promise<unknown>): Promise<unknown> =>
	Promise.resolve()
		.then(running)
		.then(
			() => 'resolved',
			(failure: unknown) => (failure instanceof FigureException ? failure.key : failure),
		);

describe('MakeHeadPartService', () => {
	it('fills every place of a prompt and refuses one that stays open', async () => {
		const service = new MakeHeadPartService(new InMemoryImageEditor(), new InMemoryPartCutter());
		expect(service.prompt(' The bald {who} gets {what}. ', { who: 'man', what: 'a cap' })).toBe(
			'The bald man gets a cap.',
		);
		expect(await failureKey(() => Promise.resolve(service.prompt('{who} and {what}', { who: 'man' })))).toBe(
			FigureExceptionKey.InvalidJob,
		);
	});

	it('hands the cutter a grid of every cell and the editor the filled prompt', async () => {
		const editor = new InMemoryImageEditor();
		const cutter = new InMemoryPartCutter();
		const service = new MakeHeadPartService(editor, cutter);
		await service.grid('m/green.png', layout, 'grid.png');
		await service.draw({ input: 'grid.png', prompt: 'A bald {who}.', fill: { who: 'woman' }, output: 'drawn.png' });
		const [, gridJob] = cutter.calls[0] ?? [];
		expect([(gridJob as { cells: unknown[] }).cells.length, editor.jobs]).toEqual([
			9,
			[{ input: 'grid.png', prompt: 'A bald woman.', output: 'drawn.png' }],
		]);
	});

	it('splits as many cells as there are stills and refuses more stills than cells', async () => {
		const cutter = new InMemoryPartCutter();
		const service = new MakeHeadPartService(new InMemoryImageEditor(), cutter);
		await service.split({ grid: 'drawn.png', layout, base: 'm/green.png', outs: ['1.png', '2.png'] });
		const [, job] = cutter.calls[0] ?? [];
		expect((job as { cells: unknown[] }).cells).toEqual([
			{ left: 0, top: 0, right: 341, bottom: 341 },
			{ left: 341, top: 0, right: 682, bottom: 341 },
		]);
		const ten = Array.from({ length: 10 }, (_, i) => `${String(i)}.png`);
		expect(await failureKey(() => service.split({ grid: 'g.png', layout, base: 'b.png', outs: ten }))).toBe(
			FigureExceptionKey.InvalidJob,
		);
	});

	it('cuts each kind by its own cut, on the green still its kind is drawn on', async () => {
		const cutter = new InMemoryPartCutter();
		const service = new MakeHeadPartService(new InMemoryImageEditor(), cutter);
		const cut = (kind: HeadPartKind, extra: object = {}): Promise<PartCutResult> =>
			service.cut({ kind, values, sources, drawing: 'd.png', out: 'o.png', ...extra });
		await cut(HeadPartKind.Hair);
		await cut(HeadPartKind.Beard);
		await cut(HeadPartKind.HairUnderHat, { hairless: 'hair-1.png', hat: 'hat-4.png' });
		await cut(HeadPartKind.Hat, { hide: 'hide.png' });
		await cut(HeadPartKind.Glasses);
		await cut(HeadPartKind.Mouth);
		expect(
			cutter.calls.map(([name, job]) => [name, (job as { green?: string }).green ?? (job as { open?: string }).open]),
		).toEqual([
			['keyCut', 'm/green.png'],
			['keyCut', 'm/green.png'],
			['keyCut', 'm/green.png'],
			['hatCut', 'm/green-accessory.png'],
			['glassesCut', 'm/green-accessory.png'],
			['variantCut', 'm/open.png'],
		]);
		expect((cutter.calls[1]?.[1] as { features: string[] }).features).toEqual([
			'm/part_eyes.png',
			'm/part_brows.png',
			'm/part_nose.png',
		]);
	});

	it('refuses a hat cut without a file for its hide and hair under a hat without its hairstyle', async () => {
		const service = new MakeHeadPartService(new InMemoryImageEditor(), new InMemoryPartCutter());
		const cut = (kind: HeadPartKind): Promise<unknown> =>
			failureKey(() => service.cut({ kind, values, sources, drawing: 'd.png', out: 'o.png' }));
		expect([await cut(HeadPartKind.Hat), await cut(HeadPartKind.HairUnderHat)]).toEqual([
			FigureExceptionKey.InvalidJob,
			FigureExceptionKey.InvalidJob,
		]);
	});

	it('lifts a hat by each hairstyle above the skull, clamped, and an empty layer by nothing', async () => {
		const cutter = new InMemoryPartCutter({ 'hair-1.png': 95, 'hair-2.png': 60, 'hair-3.png': null });
		const service = new MakeHeadPartService(new InMemoryImageEditor(), cutter);
		expect(
			await service.lifts('m/open.png', 60, 30, { '1': 'hair-1.png', '2': 'hair-2.png', '3': 'hair-3.png' }),
		).toEqual({ skullTop: 107, lift: { '1': 12, '2': 30, '3': 0 } });
	});

	it('hands the cutter the input for hair under a hat and the fit from another figure', async () => {
		const cutter = new InMemoryPartCutter();
		const service = new MakeHeadPartService(new InMemoryImageEditor(), cutter);
		await service.underHat('hair-1.png', 'hat-4.png', 17, 'in.png');
		await service.fit('m/glasses-1.png', { scale: 0.98, dx: -20.5, dy: -10.5 }, 'f/glasses-1.png');
		expect(cutter.calls).toEqual([
			['underHat', { hair: 'hair-1.png', hat: 'hat-4.png', shrink: 17, out: 'in.png' }],
			['fit', { part: 'm/glasses-1.png', scale: 0.98, dx: -20.5, dy: -10.5, out: 'f/glasses-1.png' }],
		]);
	});
});
