// makeHeadPart.service.ts — the use cases of the head parts: a grid for the image model, a drawing, its split, a cut
// of each variant and the lifts of the hair. The core decides which cells, which prompt and which cut; the ports draw
// and cut.
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import type { GridLayout } from '../../domain/Figure/gridLayout.schema.ts';
import { HeadPartKind } from '../../domain/Figure/headPartKind.enum.ts';
import type { HeadPartSource } from '../../domain/Figure/headPartSource.interface.ts';
import type { PartCutResult } from '../../domain/Figure/partCutJob.interface.ts';
import type { IImageEditor } from '../../port/outgoing/imageEditor.interface.ts';
import type { IPartCutter } from '../../port/outgoing/partCutter.interface.ts';
import { HeadPartsService } from './headParts.service.ts';
import type { CutHeadPartCommand, DrawHeadPartCommand, SplitHeadPartCommand } from './makeHeadPartCommand.ts';

/** The face parts whose variants are cut by the nearest default part. */
const faceKinds: readonly HeadPartKind[] = [
	HeadPartKind.Brows,
	HeadPartKind.Eyes,
	HeadPartKind.Nose,
	HeadPartKind.Mouth,
];

/**
 * Makes head parts.
 * @throws {FigureException} the invalid job key for a prompt with an unfilled place, more stills than cells, or a cut
 * missing a file its kind needs; the editor's and the cutter's own keys.
 */
export class MakeHeadPartService {
	private readonly decide = new HeadPartsService();

	constructor(
		private readonly editor: IImageEditor,
		private readonly cutter: IPartCutter,
	) {}

	/** The still a kind is drawn on when it draws no grid: a hat on the open green still, glasses on the accessory one. */
	template(kind: HeadPartKind, stills: { green: string; greenAccessory: string; greenOpen: string }): string {
		if (kind === HeadPartKind.Hat) return stills.greenOpen;
		return kind === HeadPartKind.Glasses ? stills.greenAccessory : stills.green;
	}

	/** Every offered variant of every kind as its layer, a hat with its hide; hidden variants are not offered. */
	offered(
		kinds: Readonly<Partial<Record<HeadPartKind, { ids: readonly number[]; hidden?: readonly number[] }>>>,
		layer: (kind: HeadPartKind, id: number) => string,
		hide: (id: number) => string,
	): HeadPartSource[] {
		return Object.values(HeadPartKind).flatMap((kind) => {
			const spec = kinds[kind];
			if (!spec) return [];
			return spec.ids
				.filter((id) => !(spec.hidden ?? []).includes(id))
				.map((id) => ({ kind, id, image: layer(kind, id), ...(kind === HeadPartKind.Hat ? { hide: hide(id) } : {}) }));
		});
	}

	/** What holds for the figure in every motion: the lift of each offered hairstyle and the hats open on top. */
	async figureHead(
		open: string,
		values: { skull: number; lift: number },
		offered: readonly HeadPartSource[],
		openTop: readonly number[],
	): Promise<{ lift: Record<string, number>; openTop: number[] }> {
		const hair = Object.fromEntries(
			offered.filter((p) => p.kind === HeadPartKind.Hair).map((p): [string, string] => [String(p.id), p.image]),
		);
		const { lift } = await this.lifts(open, values.skull, values.lift, hair);
		return { lift, openTop: [...openTop] };
	}

	/** The prompt with every `{name}` filled. */
	prompt(text: string, fill: Readonly<Record<string, string>>): string {
		const filled = text.replace(/\{([a-z]+)\}/g, (place: string, name: string) => fill[name] ?? place);
		const open = /\{[a-z]+\}/.exec(filled);
		if (open) throw new FigureException(FigureExceptionKey.InvalidJob, `the prompt's ${open[0]} is not filled`);
		return filled.trim();
	}

	/** The grid image of `still` for the image model, every cell holding the still's box. */
	async grid(still: string, layout: GridLayout, out: string): Promise<void> {
		const cells = Array.from({ length: this.decide.cells(layout) }, (_, index) => this.decide.cell(layout, index));
		await this.cutter.grid({ still, layout, cells, out });
	}

	/** Has the model draw one image. */
	async draw(command: DrawHeadPartCommand): Promise<void> {
		await this.editor.edit({
			input: command.input,
			prompt: this.prompt(command.prompt, command.fill),
			output: command.output,
		});
	}

	/** Splits a drawn grid into one still per output, cell by cell. */
	async split(command: SplitHeadPartCommand): Promise<void> {
		const { layout, outs } = command;
		if (outs.length > this.decide.cells(layout)) {
			throw new FigureException(
				FigureExceptionKey.InvalidJob,
				`${String(outs.length)} stills from a grid of fewer cells`,
			);
		}
		const cells = outs.map((_, index) => this.decide.cell(layout, index));
		await this.cutter.split({ grid: command.grid, layout, base: command.base, cells, outs });
	}

	/** Cuts one variant out of its drawing by the cut its kind takes. */
	async cut(command: CutHeadPartCommand): Promise<PartCutResult> {
		const { kind, values, sources, drawing, out } = command;
		const needed = (file: string | undefined, what: string): string => {
			if (file === undefined) throw new FigureException(FigureExceptionKey.InvalidJob, `a ${kind} cut needs ${what}`);
			return file;
		};
		switch (kind) {
			case HeadPartKind.Hair:
				return this.cutter.keyCut({ kind, values: values.key, green: sources.green, mask: sources.mask, drawing, out });
			case HeadPartKind.Beard: {
				const features = [HeadPartKind.Eyes, HeadPartKind.Brows, HeadPartKind.Nose].map((part) =>
					needed(sources.defaults[part], `the default ${part}`),
				);
				return this.cutter.keyCut({
					kind,
					values: values.key,
					green: sources.green,
					mask: sources.mask,
					drawing,
					out,
					features,
				});
			}
			case HeadPartKind.HairUnderHat:
				return this.cutter.keyCut({
					kind,
					values: values.key,
					green: sources.green,
					mask: sources.mask,
					drawing,
					out,
					hairless: needed(command.hairless, 'the hairstyle without the hat'),
					hat: needed(command.hat, 'the hat'),
					open: sources.open,
				});
			case HeadPartKind.Hat:
				return this.cutter.hatCut({
					values: values.hat,
					greenOpen: sources.greenOpen,
					green: sources.greenAccessory,
					mask: sources.mask,
					drawing,
					out,
					hide: needed(command.hide, 'a file for its hide'),
				});
			case HeadPartKind.Glasses:
				return this.cutter.glassesCut({ values: values.glasses, green: sources.greenAccessory, drawing, out });
			default: {
				const defaults = Object.fromEntries(
					faceKinds.map((part) => [part, needed(sources.defaults[part], `the default ${part}`)]),
				);
				return this.cutter.variantCut({
					part: kind,
					values: values.variant,
					open: sources.open,
					blank: sources.blank,
					mask: sources.mask,
					defaults,
					drawing,
					out,
				});
			}
		}
	}

	/** The input for hair under a hat: the hairstyle's still with the hat shrunk by `shrink` pixels, flat magenta. */
	async underHat(hair: string, hat: string, shrink: number, out: string): Promise<void> {
		await this.cutter.underHat({ hair, hat, shrink, out });
	}

	/** A layer of another figure fitted to this one by the spec's scale and shift. */
	async fit(part: string, fitted: { scale: number; dx: number; dy: number }, out: string): Promise<void> {
		await this.cutter.fit({ part, scale: fitted.scale, dx: fitted.dx, dy: fitted.dy, out });
	}

	/** The skull's top on the open still and, per hairstyle, how far a hat rises for it, never more than `most`. */
	async lifts(
		open: string,
		threshold: number,
		most: number,
		hair: Readonly<Record<string, string>>,
	): Promise<{ skullTop: number; lift: Record<string, number> }> {
		const skullTop = await this.cutter.skullTop(open, threshold);
		const ids = Object.keys(hair);
		const rows = await this.cutter.firstRows(ids.map((id) => hair[id] ?? ''));
		const lift = Object.fromEntries(
			ids.map((id, k) => {
				const first = rows[k] ?? null;
				return [id, first === null ? 0 : this.decide.lift(skullTop, first, most)];
			}),
		);
		return { skullTop, lift };
	}
}
