// makeHeadPartCommand.ts — what the head-part commands hand the core: the files resolved by the app, the values from
// its configuration.
import type { GridLayout } from '../../domain/Figure/gridLayout.schema.ts';
import type { HeadCutConfig } from '../../domain/Figure/headCutConfig.schema.ts';
import type { HeadPartKind } from '../../domain/Figure/headPartKind.enum.ts';

/** One drawing: the image the model edits, the prompt with its `{name}` places, what fills them, the output. */
export interface DrawHeadPartCommand {
	readonly input: string;
	readonly prompt: string;
	readonly fill: Readonly<Record<string, string>>;
	readonly output: string;
}

/** A drawn grid split back into one still per output, on copies of `base`. */
export interface SplitHeadPartCommand {
	readonly grid: string;
	readonly layout: GridLayout;
	readonly base: string;
	readonly outs: readonly string[];
}

/** The figure's sources a cut reads, by the role they play. */
export interface HeadSources {
	readonly green: string;
	readonly greenAccessory: string;
	readonly greenOpen: string;
	readonly open: string;
	readonly blank: string;
	readonly mask: string;
	/** The default face parts by kind: brows, eyes, nose and mouth. */
	readonly defaults: Readonly<Partial<Record<HeadPartKind, string>>>;
}

/** One variant cut out of its drawing; a hat also writes its hide, hair under a hat reads its hairstyle and hat. */
export interface CutHeadPartCommand {
	readonly kind: HeadPartKind;
	readonly values: HeadCutConfig;
	readonly sources: HeadSources;
	readonly drawing: string;
	readonly out: string;
	readonly hide?: string;
	readonly hairless?: string;
	readonly hat?: string;
}
