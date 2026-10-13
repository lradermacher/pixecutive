// partCutter.interface.ts — the pixel work of the head parts: grids for the image model, the cuts of its drawings,
// and the rows the core measures the lift by.
import type {
	FitJob,
	GlassesCutJob,
	GridJob,
	HatCutJob,
	KeyCutJob,
	PartCutResult,
	SplitJob,
	UnderHatJob,
	VariantCutJob,
} from '../../domain/Figure/partCutJob.interface.ts';

/** The part cutter: each call writes its job's outputs; rejects with a `FigureException`. */
export interface IPartCutter {
	grid(job: GridJob): Promise<void>;
	split(job: SplitJob): Promise<void>;
	keyCut(job: KeyCutJob): Promise<PartCutResult>;
	hatCut(job: HatCutJob): Promise<PartCutResult>;
	glassesCut(job: GlassesCutJob): Promise<PartCutResult>;
	variantCut(job: VariantCutJob): Promise<PartCutResult>;
	underHat(job: UnderHatJob): Promise<void>;
	fit(job: FitJob): Promise<void>;
	/** The first row of the open still that differs from its background by more than `threshold`: the skull's top. */
	skullTop(open: string, threshold: number): Promise<number>;
	/** Per layer the first row with any opacity, or null for an empty layer, in one pass. */
	firstRows(layers: readonly string[]): Promise<(number | null)[]>;
}
