// renderImage.service.ts — the use case "render one image": checks the job, then hands it to the local renderer.
import { renderJobSchema } from '../../domain/Render/renderJob.schema.ts';
import type { RenderResult } from '../../domain/Render/renderResult.interface.ts';
import type { RenderStatus } from '../../domain/Render/renderStatus.interface.ts';
import type { ILocalRenderer } from '../../port/outgoing/localRenderer.interface.ts';
import { RenderException } from '../exception/render.exception.ts';
import { RenderExceptionKey } from '../exception/renderExceptionKey.enum.ts';

/** Renders one image and tells what the renderer is doing; a job the model cannot take never reaches it. */
export class RenderImageService {
	constructor(private readonly renderer: ILocalRenderer) {}

	/** Checks `job` against the render job schema; the renderer starts only for a valid job. */
	render(job: unknown): Promise<RenderResult> {
		const parsed = renderJobSchema.safeParse(job);
		if (!parsed.success) {
			return Promise.reject(
				new RenderException(
					RenderExceptionKey.InvalidJob,
					parsed.error.issues.map((issue) => issue.message).join('; '),
				),
			);
		}
		return this.renderer.render(parsed.data);
	}

	/** The running render, the memory and the last log rows. */
	status(): RenderStatus {
		return this.renderer.status();
	}
}
