// videoRenderer.interface.ts — renders one motion clip with the local video model, one job at a time, under the
// memory guard.
import type { ClipJob } from '../../domain/Figure/clipJob.schema.ts';
import type { ClipResult } from '../../domain/Figure/clipResult.interface.ts';

/**
 * The local video renderer. `render` rejects with a `FigureException` (clip failed or invalid job) when an input is
 * missing, the memory refuses or stops the run, or the model fails.
 */
export interface IVideoRenderer {
	render(job: ClipJob): Promise<ClipResult>;
}
