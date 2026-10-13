// frameMeasurer.interface.ts — measures every frame of a clip so the core can decide which become sprites.
import type { FrameCutConfig } from '../../domain/Figure/frameCutConfig.schema.ts';
import type { FrameMeasure } from '../../domain/Figure/frameMeasure.schema.ts';

/** The frame measurer: one measure per video frame, in order; rejects with a `FigureException` (frames failed). */
export interface IFrameMeasurer {
	measure(clip: string, values: FrameCutConfig): Promise<FrameMeasure[]>;
}
