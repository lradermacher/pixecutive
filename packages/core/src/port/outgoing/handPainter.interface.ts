// handPainter.interface.ts — paints drawn finger states into a motion's sprites where the hands are.
import type { HandPaintJob } from '../../domain/Figure/handPaintJob.interface.ts';

/** The hand painter: finds the hands in each sprite and paints its state there; rejects with a `FigureException`. */
export interface IHandPainter {
	paint(job: HandPaintJob): Promise<void>;
}
