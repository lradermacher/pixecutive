// partCutJob.interface.ts — the jobs of the part cutter and what each answers: the grids that put several drawings
// into one image, the cuts of a drawn part out of the model's image, and the measures the core decides on.
import type { GridLayout } from './gridLayout.schema.ts';
import type { HeadCutConfig } from './headCutConfig.schema.ts';
import type { HeadPartKind } from './headPartKind.enum.ts';
import type { StillBox } from './stillBox.schema.ts';

/** The still's grid box once per cell, written to `out`. */
export interface GridJob {
	readonly still: string;
	readonly layout: GridLayout;
	readonly cells: readonly StillBox[];
	readonly out: string;
}

/** Each cell of a drawn grid back into the still's box on a copy of `base`, one still per output. */
export interface SplitJob {
	readonly grid: string;
	readonly layout: GridLayout;
	readonly cells: readonly StillBox[];
	readonly base: string;
	readonly outs: readonly string[];
}

/** Hair, a beard or hair under a hat keyed out of a drawing on the green still. */
export interface KeyCutJob {
	readonly kind: HeadPartKind;
	readonly values: HeadCutConfig['key'];
	readonly green: string;
	readonly mask: string;
	readonly drawing: string;
	readonly out: string;
	/** For a beard: the default eyes, brows and nose, which a beard never covers. */
	readonly features?: readonly string[];
	/** For hair under a hat: the same hairstyle without the hat, the hat, and the open still. */
	readonly hairless?: string;
	readonly hat?: string;
	readonly open?: string;
}

/** A hat and its hide cut out of a drawing on the open green still. */
export interface HatCutJob {
	readonly values: HeadCutConfig['hat'];
	readonly greenOpen: string;
	readonly green: string;
	readonly mask: string;
	readonly drawing: string;
	readonly out: string;
	readonly hide: string;
}

/** Glasses cut out of a drawing on the accessory green still. */
export interface GlassesCutJob {
	readonly values: HeadCutConfig['glasses'];
	readonly green: string;
	readonly drawing: string;
	readonly out: string;
}

/** A face part's variant cut out of a drawing of the approved face. */
export interface VariantCutJob {
	readonly part: HeadPartKind;
	readonly values: HeadCutConfig['variant'];
	readonly open: string;
	readonly blank: string;
	readonly mask: string;
	/** The default brows, eyes, nose and mouth, each by its kind. */
	readonly defaults: Readonly<Partial<Record<HeadPartKind, string>>>;
	readonly drawing: string;
	readonly out: string;
}

/** The input for hair under a hat: the hairstyle's still, at the hat layer's size, with the hat shrunk on top. */
export interface UnderHatJob {
	readonly hair: string;
	readonly hat: string;
	readonly shrink: number;
	readonly out: string;
}

/** A part of another figure scaled about its centre and moved. */
export interface FitJob {
	readonly part: string;
	readonly scale: number;
	readonly dx: number;
	readonly dy: number;
	readonly out: string;
}

/** How a drawing was aligned to its template, and how many pixels the part kept. */
export interface PartCutResult {
	readonly pixels: number;
	readonly scale?: number;
	readonly dx?: number;
	readonly dy?: number;
	readonly error?: number;
	/** For a hat: the pixels its hide cuts away. */
	readonly hide?: number;
}
