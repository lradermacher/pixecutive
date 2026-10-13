// frameCutter.interface.ts — applies a frame plan: shifts, grounds, crops and scales the chosen frames into sprites.
import type { CutResult } from '../../domain/Figure/cutResult.interface.ts';
import type { FrameCutConfig } from '../../domain/Figure/frameCutConfig.schema.ts';
import type { FramePlan } from '../../domain/Figure/framePlan.schema.ts';

/** The frame cutter: writes one sprite per planned frame; rejects with a `FigureException` (frames failed). */
export interface IFrameCutter {
	cut(clip: string, plan: FramePlan, values: FrameCutConfig): Promise<CutResult>;
}
