// localRenderer.interface.ts — renders one image with a model on this machine, one job at a time, under a memory guard.
import type { RenderJob } from '../../domain/Render/renderJob.schema.ts';
import type { RenderResult } from '../../domain/Render/renderResult.interface.ts';
import type { RenderStatus } from '../../domain/Render/renderStatus.interface.ts';

/**
 * The local renderer. `render` rejects with a `RenderException` when an input is missing, it is busy, the memory
 * refuses the start, the guard or an interrupt stops the run, the renders folder fails or the model fails; every run
 * it starts leaves one row in its log.
 */
export interface ILocalRenderer {
	render(job: RenderJob): Promise<RenderResult>;
	status(): RenderStatus;
}
